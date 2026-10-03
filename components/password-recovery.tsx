"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { createRecoveryFlow, parseRecoveryLink } from "@/lib/auth-recovery";
import { recoveryErrorMessage } from "@/lib/auth-errors";

type Flow = ReturnType<typeof createRecoveryFlow>;
type Prepared = { flow: Flow | null; state: "request" | "ready" | "unconfigured"; email: string; error: string };

async function prepareRecovery(): Promise<Prepared> {
  const link = parseRecoveryLink(window.location.hash, window.location.search);
  // Remove credentials before creating any auth client or making a network request.
  window.history.replaceState(null, "", "/auth/recover");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { flow: null, state: "unconfigured", email: "", error: "Hesap bağlantısı henüz yapılandırılmadı. Hesap yöneticisiyle iletişime geçin." };
  // Never import the shared Supabase singleton here: it consumes implicit URL sessions.
  const client = createClient(url, key, { auth: {
    storageKey: "fark-password-recovery", persistSession: false,
    detectSessionInUrl: false, autoRefreshToken: false
  }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) } });
  const flow = createRecoveryFlow(client.auth);
  if (link.kind !== "tokens") return { flow, state: "request", email: "", error: link.kind === "invalid" ? recoveryErrorMessage({ code: "recovery_link_invalid" }) : "" };
  try {
    const { email } = await flow.verify(link.tokens);
    return { flow, state: "ready", email, error: "" };
  } catch (error) {
    return { flow, state: "request", email: "", error: recoveryErrorMessage(error) };
  }
}

export default function PasswordRecovery() {
  const initialization = useRef<Promise<Prepared> | null>(null);
  const flow = useRef<Flow | null>(null);
  const [state, setState] = useState<Prepared["state"] | "checking" | "sent" | "success">("checking");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let mounted = true;
    // React Strict Mode may rerun this effect after URL cleanup; share one preparation.
    initialization.current ||= prepareRecovery();
    initialization.current.then(result => {
      if (!mounted) return;
      flow.current = result.flow; setState(result.state); setEmail(result.email); setError(result.error);
    }).catch(error => {
      if (mounted) { setState("unconfigured"); setError(recoveryErrorMessage(error)); }
    });
    return () => { mounted = false; };
  }, []);

  return <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 20 }}>
    <section className="modal" style={{ width: "100%", maxWidth: 480, maxHeight: "none" }} aria-labelledby="recovery-title">
      <div className="eyebrow">FARK ÇALIŞMA ALANI</div>
      <h1 id="recovery-title" style={{ fontSize: 24, margin: "12px 0" }}>{state === "ready" ? "Yeni parolanızı belirleyin" : state === "success" ? "Parolanız güncellendi" : "Parolamı unuttum"}</h1>
      {state === "checking" && <p role="status">Kurtarma bağlantısı doğrulanıyor…</p>}
      {state === "ready" && <>
        <p>{email ? <><strong>{email}</strong> hesabı için yeni bir parola oluşturun.</> : "Hesabınız için yeni bir parola oluşturun."} En az 8 karakter kullanın.</p>
        <form onSubmit={async event => {
          event.preventDefault(); if (busy || !flow.current) return;
          const form = event.currentTarget;
          const fields = new FormData(form);
          setError(""); setBusy(true);
          try {
            await flow.current.update(String(fields.get("password") || ""), String(fields.get("confirmation") || ""));
            form.reset(); flow.current = null; setState("success");
          } catch (error) {
            setError(recoveryErrorMessage(error));
            if (error && typeof error === "object" && "code" in error && error.code === "recovery_link_invalid") { form.reset(); setState("request"); }
          } finally { setBusy(false); }
        }}>
          <label>Yeni parola<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={busy}/></label>
          <label>Yeni parola tekrar<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required disabled={busy}/></label>
          <button className="button primary full" type="submit" disabled={busy}>{busy ? "Parola güncelleniyor…" : "Parolayı güncelle"}</button>
        </form>
      </>}
      {(state === "request" || state === "sent") && <>
        <p>Fark uygulamasında kullandığınız e-posta adresini yazın. Bu parola, Supabase yönetim paneli parolanızdan bağımsızdır.</p>
        {state === "sent" && <p role="status">Bu adres için bir hesap varsa kurtarma e-postası gönderilecektir. Gelen kutusu ve spam klasörünü kontrol edin; en son gelen bağlantıyı kullanın.</p>}
        <form onSubmit={async event => {
          event.preventDefault(); if (busy || !flow.current) return;
          const fields = new FormData(event.currentTarget);
          setError(""); setBusy(true);
          try { await flow.current.request(String(fields.get("email") || ""), window.location.origin); setState("sent"); }
          catch (error) { setError(recoveryErrorMessage(error)); }
          finally { setBusy(false); }
        }}>
          <label>Hesabınızın e-posta adresi<input name="email" type="email" autoComplete="email" defaultValue={email} required disabled={busy}/></label>
          <button className="button primary full" type="submit" disabled={busy}>{busy ? "İstek gönderiliyor…" : state === "sent" ? "Yeniden bağlantı iste" : "Kurtarma bağlantısı gönder"}</button>
        </form>
      </>}
      {state === "success" && <p role="status">{email && <><strong>{email}</strong> hesabının </>}yeni parolası kaydedildi. Yeni parolanızla giriş yapabilirsiniz.</p>}
      {error && <p className="error-text" role="alert" style={{ marginTop: 16 }}>{error}</p>}
      <a className="text-button" href="/?login=1" style={{ display: "inline-block", marginTop: 24 }}>Girişe dön</a>
    </section>
  </main>;
}
