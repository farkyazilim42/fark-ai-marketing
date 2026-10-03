"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="content"><section className="panel setup-panel"><div><h1>Çalışma alanı yüklenemedi</h1><p>Tekrar deneyin. Sorun sürerse sayfayı yenileyin; kaydedilmiş verileriniz tekrar yüklenir.</p></div><button className="button primary" onClick={reset}>Tekrar dene</button></section></main>;
}
