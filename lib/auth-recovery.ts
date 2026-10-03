import type { SupabaseClient } from "@supabase/supabase-js";

type RecoveryAuth = Pick<SupabaseClient["auth"], "getUser" | "setSession" | "resetPasswordForEmail" | "updateUser" | "signOut">;
export type RecoveryTokens = { accessToken: string; refreshToken: string };
export type RecoveryLink = { kind: "request" } | { kind: "invalid" } | { kind: "tokens"; tokens: RecoveryTokens };
const recoveryFields = ["access_token", "refresh_token", "type", "token_hash", "code", "error", "error_code", "error_description"];

/** Parse only default Supabase implicit recovery links; URL contents never grant a session alone. */
export function parseRecoveryLink(hash: string, search = ""): RecoveryLink {
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  if (recoveryFields.some(key => query.has(key))) return { kind: "invalid" };
  if (!recoveryFields.some(key => fragment.has(key))) return { kind: "request" };
  if (["error", "error_code", "error_description", "code", "token_hash"].some(key => fragment.has(key))) return { kind: "invalid" };
  if (["type", "access_token", "refresh_token"].some(key => fragment.getAll(key).length !== 1) || fragment.get("type") !== "recovery") return { kind: "invalid" };
  const accessToken = fragment.get("access_token") || "";
  const refreshToken = fragment.get("refresh_token") || "";
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(accessToken) || accessToken.length > 16_384 || !refreshToken || refreshToken.length > 16_384 || /\s/.test(refreshToken)) return { kind: "invalid" };
  return { kind: "tokens", tokens: { accessToken, refreshToken } };
}

export function recoveryRedirect(origin: string): string {
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid recovery origin");
  return new URL("/auth/recover", url.origin).toString();
}

export class RecoveryFlowError extends Error {
  code: string;
  constructor(code: string) { super(code); this.name = "RecoveryFlowError"; this.code = code; }
}

export function validateRecoveryPassword(password: string, confirmation: string): void {
  // Password characters, including leading and trailing spaces, are never changed.
  if (password.length < 8) throw new RecoveryFlowError("password_too_short");
  if (password.length > 1024) throw new RecoveryFlowError("password_too_long");
  if (password !== confirmation) throw new RecoveryFlowError("password_mismatch");
}

/** Isolated, memory-only recovery: no existing browser session is accepted as link proof. */
export function createRecoveryFlow(auth: RecoveryAuth, now: () => number = Date.now) {
  let proof: { userId: string; email: string; expiresAt: number } | null = null;
  function requireProof() {
    // The SDK refreshes during updateUser inside a 90-second expiry margin, even with
    // autoRefreshToken:false. Refuse that window instead of trusting another refresh token.
    if (!proof || proof.expiresAt * 1000 <= now() + 120_000) {
      proof = null;
      throw new RecoveryFlowError("recovery_link_invalid");
    }
    return proof;
  }
  return {
    async verify(tokens: RecoveryTokens): Promise<{ email: string }> {
      proof = null;
      const checked = await auth.getUser(tokens.accessToken);
      if (checked.error || !checked.data.user?.id) throw new RecoveryFlowError("recovery_link_invalid");
      const established = await auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
      const session = established.data.session;
      if (established.error || !session || session.user.id !== checked.data.user.id || established.data.user?.id !== checked.data.user.id || !Number.isFinite(session.expires_at)) throw new RecoveryFlowError("recovery_link_invalid");
      proof = { userId: checked.data.user.id, email: checked.data.user.email || "", expiresAt: session.expires_at! };
      return { email: requireProof().email };
    },
    async request(email: string, origin: string): Promise<void> {
      const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: recoveryRedirect(origin) });
      if (error) throw error;
    },
    async update(password: string, confirmation: string): Promise<{ signedOut: boolean }> {
      validateRecoveryPassword(password, confirmation);
      const expected = requireProof();
      let current;
      try { current = await auth.getUser(); } catch (error) { proof = null; throw error; }
      if (current.error || current.data.user?.id !== expected.userId) {
        proof = null;
        throw new RecoveryFlowError("recovery_link_invalid");
      }
      requireProof();
      const result = await auth.updateUser({ password });
      if (result.error) throw result.error;
      proof = null;
      if (result.data.user?.id !== expected.userId) throw new RecoveryFlowError("recovery_link_invalid");
      try { const logout = await auth.signOut({ scope: "local" }); return { signedOut: !logout.error }; }
      catch { return { signedOut: false }; }
    }
  };
}
