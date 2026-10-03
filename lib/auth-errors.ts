/** Show actionable login errors without exposing raw service responses or credentials. */
export function loginErrorMessage(error: unknown): string {
  const value = error && typeof error === "object" ? error as { code?: unknown; name?: unknown; status?: unknown } : {};
  const code = typeof value.code === "string" ? value.code : "";
  switch (code) {
    case "invalid_credentials":
      return "E-posta ve parola eşleşmedi. Bu uygulama için oluşturulan hesabın bilgilerini kontrol edin.";
    case "email_not_confirmed":
    case "provider_email_needs_verification":
      return "E-posta adresiniz henüz doğrulanmamış. Hesap doğrulamasını tamamlayın.";
    case "email_provider_disabled":
    case "provider_disabled":
      return "E-posta ile giriş etkin değil. Hesap yöneticisiyle iletişime geçin.";
    case "user_banned":
      return "Bu hesabın girişi devre dışı bırakılmış. Hesap yöneticisiyle iletişime geçin.";
    case "captcha_failed":
      return "Güvenlik doğrulaması tamamlanamadı. Hesap yöneticisiyle iletişime geçin.";
    case "over_request_rate_limit":
      return "Çok fazla giriş denemesi yapıldı. Biraz bekleyip tekrar deneyin.";
    case "request_timeout":
      return "Giriş isteği zaman aşımına uğradı. Lütfen tekrar deneyin.";
  }
  if (value.status === 429) return "Çok fazla giriş denemesi yapıldı. Biraz bekleyip tekrar deneyin.";
  if (value.name === "AbortError" || value.name === "TimeoutError") return "Giriş isteği zaman aşımına uğradı. Lütfen tekrar deneyin.";
  if (value.name === "AuthRetryableFetchError" || value.name === "TypeError" || value.status === 0) return "Giriş hizmetine ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.";
  if (value.status === 401 || value.status === 403) return "Giriş hizmeti bağlantısı doğrulanamadı. Hesap yöneticisiyle iletişime geçin.";
  if (typeof value.status === "number" && value.status >= 500) return "Giriş hizmeti geçici olarak kullanılamıyor. Biraz sonra tekrar deneyin.";
  return "Giriş tamamlanamadı. Lütfen tekrar deneyin; sorun sürerse hesap yöneticisiyle iletişime geçin.";
}

/** Only static, public recovery guidance is shown; service messages may contain secrets. */
export function recoveryErrorMessage(error: unknown): string {
  const value = error && typeof error === "object" ? error as { code?: unknown; name?: unknown; status?: unknown } : {};
  switch (value.code) {
    case "recovery_link_invalid": case "otp_expired": case "flow_state_expired": case "session_not_found": case "refresh_token_not_found": case "refresh_token_already_used":
      return "Kurtarma bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyin ve en son gelen e-postayı kullanın.";
    case "password_too_short": return "Yeni parola en az 8 karakter olmalıdır.";
    case "password_too_long": return "Yeni parola en fazla 1024 karakter olabilir.";
    case "password_mismatch": return "Yeni parola ve tekrarı eşleşmiyor.";
    case "weak_password": return "Bu parola hesabın güvenlik koşullarını karşılamıyor. Daha uzun, güçlü ve farklı bir parola seçin.";
    case "same_password": return "Yeni parolanız önceki parolanızdan farklı olmalıdır.";
    case "over_email_send_rate_limit": case "over_request_rate_limit":
      return "Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.";
    case "email_provider_disabled": case "email_address_not_authorized":
      return "Kurtarma e-postası hizmeti bu işlem için yapılandırılmamış. Hesap yöneticisiyle iletişime geçin.";
  }
  if (value.status === 429) return "Çok fazla istek gönderildi. Biraz bekleyip tekrar deneyin.";
  if (value.name === "AbortError" || value.name === "TimeoutError" || value.code === "request_timeout") return "İstek zaman aşımına uğradı. Bağlantınızı kontrol edip tekrar deneyin.";
  if (value.name === "TypeError" || value.name === "AuthRetryableFetchError" || value.status === 0) return "Hesap hizmetine ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.";
  return "İşlem tamamlanamadı. Tekrar deneyin; sorun sürerse yeni kurtarma bağlantısı isteyin veya hesap yöneticisiyle iletişime geçin.";
}
