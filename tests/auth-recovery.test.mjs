import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryFlow, parseRecoveryLink, recoveryRedirect, validateRecoveryPassword } from '../lib/auth-recovery.ts';
import { recoveryErrorMessage } from '../lib/auth-errors.ts';

const tokens = { accessToken: 'header.payload.signature', refreshToken: 'test-refresh-token' };
const now = 1_800_000_000_000;
const user = { id: 'recovered-user', email: 'member@example.test' };
function fixture(overrides = {}, clock = () => now) {
  const calls = [];
  const auth = {
    getUser: async token => { calls.push(['getUser', token]); return { data: { user }, error: null }; },
    setSession: async input => { calls.push(['setSession', input]); return { data: { user, session: { user, expires_at: now / 1000 + 3600 } }, error: null }; },
    updateUser: async input => { calls.push(['updateUser', input]); return { data: { user }, error: null }; },
    resetPasswordForEmail: async (...input) => { calls.push(['resetPasswordForEmail', ...input]); return { data: {}, error: null }; },
    signOut: async input => { calls.push(['signOut', input]); return { error: null }; },
    ...overrides
  };
  return { calls, auth, flow: createRecoveryFlow(auth, clock) };
}

test('recovery link requires both unique fragment tokens and exact recovery type', () => {
  assert.deepEqual(parseRecoveryLink(''), { kind: 'request' });
  const fragment = '#type=recovery&access_token=header.payload.signature&refresh_token=test-refresh-token&expires_in=3600';
  assert.deepEqual(parseRecoveryLink(fragment), { kind: 'tokens', tokens });
  for (const bad of ['#type=recovery', '#type=signup&access_token=a.b.c&refresh_token=x', fragment + '&access_token=other', '#error_code=otp_expired', '#type=recovery&access_token=bad&refresh_token=x', '#type=recovery&access_token=a.b.c&refresh_token=x+y']) {
    assert.equal(parseRecoveryLink(bad).kind, 'invalid');
  }
  assert.equal(parseRecoveryLink(fragment, '?access_token=leaked').kind, 'invalid');
  assert.equal(parseRecoveryLink('', '?code=unsupported-pkce').kind, 'invalid');
});

test('existing authenticated user alone cannot authorize password change', async () => {
  const { calls, flow } = fixture();
  await assert.rejects(flow.update('new secure password', 'new secure password'), { code: 'recovery_link_invalid' });
  assert.deepEqual(calls, []);
});

test('access token is remotely validated before session establishment; expired token fails closed', async () => {
  const { calls, flow } = fixture({ getUser: async () => ({ data: { user: null }, error: { code: 'bad_jwt' } }) });
  await assert.rejects(flow.verify(tokens), { code: 'recovery_link_invalid' });
  await assert.rejects(flow.update('new secure password', 'new secure password'), { code: 'recovery_link_invalid' });
  assert.deepEqual(calls, []);
});

test('mismatched session identity and near-expiry sessions never authorize updates', async () => {
  for (const session of [{ user: { id: 'different-user' }, expires_at: now / 1000 + 3600 }, { user, expires_at: now / 1000 + 120 }, { user }]) {
    const { calls, flow } = fixture({ setSession: async () => ({ data: { user: session.user, session }, error: null }) });
    await assert.rejects(flow.verify(tokens), { code: 'recovery_link_invalid' });
    await assert.rejects(flow.update('new secure password', 'new secure password'), { code: 'recovery_link_invalid' });
    assert.equal(calls.some(c => c[0] === 'updateUser'), false);
  }
});

test('verified account is revalidated before update and password whitespace is preserved', async () => {
  const { calls, flow } = fixture();
  assert.deepEqual(await flow.verify(tokens), { email: user.email });
  const password = '  new secure password  ';
  assert.deepEqual(await flow.update(password, password), { signedOut: true });
  assert.deepEqual(calls.map(c => c[0]), ['getUser', 'setSession', 'getUser', 'updateUser', 'signOut']);
  assert.equal(calls[0][1], tokens.accessToken);
  assert.equal(calls[2][1], undefined);
  assert.deepEqual(calls[3][1], { password });
  assert.deepEqual(calls[4][1], { scope: 'local' });
  await assert.rejects(flow.update(password, password), { code: 'recovery_link_invalid' });
});

test('changed account or elapsed expiry margin blocks the update even after a valid link', async () => {
  const changed = fixture();
  await changed.flow.verify(tokens);
  changed.auth.getUser = async () => ({ data: { user: { id: 'different-user' } }, error: null });
  await assert.rejects(changed.flow.update('new secure password', 'new secure password'), { code: 'recovery_link_invalid' });
  assert.equal(changed.calls.some(c => c[0] === 'updateUser'), false);
  let clock = now;
  const expired = fixture({}, () => clock);
  await expired.flow.verify(tokens);
  expired.auth.getUser = async () => { clock += 3_500_000; return { data: { user }, error: null }; };
  await assert.rejects(expired.flow.update('new secure password', 'new secure password'), { code: 'recovery_link_invalid' });
  assert.equal(expired.calls.some(c => c[0] === 'updateUser'), false);
});

test('password validation is local and rejects short/mismatched values without any auth mutation', async () => {
  assert.throws(() => validateRecoveryPassword('short', 'short'), { code: 'password_too_short' });
  assert.throws(() => validateRecoveryPassword('eightchars', 'different'), { code: 'password_mismatch' });
  const { calls, flow } = fixture();
  await flow.verify(tokens);
  await assert.rejects(flow.update('different', 'mismatch'), { code: 'password_mismatch' });
  assert.equal(calls.some(c => c[0] === 'updateUser'), false);
});

test('recovery email is only requested explicitly; trims email and fixes same-origin redirect', async () => {
  const { calls, flow } = fixture();
  assert.deepEqual(calls, []);
  await flow.request('  member@example.test  ', 'https://app.example.test');
  assert.deepEqual(calls, [['resetPasswordForEmail', 'member@example.test', { redirectTo: 'https://app.example.test/auth/recover' }]]);
  assert.equal(recoveryRedirect('https://app.example.test/untrusted?next=https://elsewhere.test'), 'https://app.example.test/auth/recover');
  assert.throws(() => recoveryRedirect('javascript:alert(1)'));
});

test('successful update stays successful if recovery-session logout fails; proof cannot be reused', async () => {
  const { flow } = fixture({ signOut: async () => { throw new Error('network unavailable'); } });
  await flow.verify(tokens);
  assert.deepEqual(await flow.update('new secure password', 'new secure password'), { signedOut: false });
  await assert.rejects(flow.update('new secure password', 'new secure password'), { code: 'recovery_link_invalid' });
});

test('recovery errors are actionable static messages and never expose raw service details', () => {
  assert.match(recoveryErrorMessage({ code: 'otp_expired' }), /Yeni bir bağlantı/);
  assert.match(recoveryErrorMessage({ code: 'weak_password' }), /güvenlik koşullarını/);
  assert.match(recoveryErrorMessage({ code: 'same_password' }), /farklı/);
  assert.match(recoveryErrorMessage({ status: 429 }), /Çok fazla/);
  for (const error of [new Error('access_token=private'), { code: 'unknown', message: 'password=private' }]) assert.doesNotMatch(recoveryErrorMessage(error), /private|access_token|password=/);
});
