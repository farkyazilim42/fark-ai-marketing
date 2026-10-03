import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginErrorMessage } from '../lib/auth-errors.ts';

test('only a confirmed invalid_credentials rejection is presented as an email/password mismatch', () => {
  const rejected = loginErrorMessage({ code: 'invalid_credentials', status: 400 });
  assert.match(rejected, /E-posta ve parola eşleşmedi/);
  for (const error of [{ code: 'email_not_confirmed', status: 400 }, { code: 'email_provider_disabled', status: 400 }, { code: 'captcha_failed', status: 400 }, { status: 401 }, { status: 500 }, { name: 'AuthRetryableFetchError' }, { code: 'unexpected_failure', status: 400 }]) {
    assert.notEqual(loginErrorMessage(error), rejected);
    assert.doesNotMatch(loginErrorMessage(error), /parola eşleşmedi/);
  }
});

test('confirmation, provider, CAPTCHA and disabled account errors give distinct next steps', () => {
  assert.match(loginErrorMessage({ code: 'email_not_confirmed' }), /henüz doğrulanmamış/);
  assert.match(loginErrorMessage({ code: 'email_provider_disabled' }), /E-posta ile giriş etkin değil/);
  assert.match(loginErrorMessage({ code: 'captcha_failed' }), /Güvenlik doğrulaması/);
  assert.match(loginErrorMessage({ code: 'user_banned' }), /devre dışı/);
});

test('transport, timeout and rate limits are not mistaken for password rejection', () => {
  assert.match(loginErrorMessage({ code: 'over_request_rate_limit', status: 429 }), /Çok fazla/);
  assert.match(loginErrorMessage({ status: 429 }), /Çok fazla/);
  assert.match(loginErrorMessage({ code: 'request_timeout' }), /zaman aşımına/);
  assert.match(loginErrorMessage({ name: 'AbortError' }), /zaman aşımına/);
  assert.match(loginErrorMessage(new TypeError('Failed to fetch')), /ulaşılamadı/);
  assert.match(loginErrorMessage({ status: 503 }), /geçici olarak/);
});

test('raw error messages and unknown service codes never reach the login UI', () => {
  const privateText = 'password=not-a-real-password token=not-a-real-token';
  for (const error of [null, undefined, privateText, new Error(privateText), { code: privateText, message: privateText }, { status: 401, message: privateText }]) {
    const output = loginErrorMessage(error);
    assert.ok(output.length > 0);
    assert.ok(!output.includes(privateText));
    assert.ok(!output.includes('token='));
  }
});
