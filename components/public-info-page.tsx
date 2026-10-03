import type { ReactNode } from "react";
import styles from "./public-info-page.module.css";

export const operatorName = "FARK DONANIM VE YAZILIM TEKNOLOJİLERİ SAN. TİC. LTD. ŞTİ.";
export const supportEmail = "kaplans08@gmail.com";

export default function PublicInfoPage({ title, description, current, children }: {
  title: string; description: string; current: "about" | "privacy" | "terms"; children: ReactNode;
}) {
  return <div className={styles.page}>
    <header className={styles.header}>
      <a className={styles.brand} href="/about">FARK <span>AI Marketing</span></a>
      <nav aria-label="Uygulama bilgileri">
        <a href="/about" aria-current={current === "about" ? "page" : undefined}>Uygulama</a>
        <a href="/privacy" aria-current={current === "privacy" ? "page" : undefined}>Gizlilik</a>
        <a href="/terms" aria-current={current === "terms" ? "page" : undefined}>Kullanım koşulları</a>
      </nav>
    </header>
    <main id="main-content" className={styles.main}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>FARK AI MARKETING</p>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
        <p className={styles.updated}>Son güncelleme: <time dateTime="2026-10-03">3 Ekim 2026</time></p>
      </div>
      <article className={styles.content}>{children}</article>
    </main>
    <footer className={styles.footer}>
      <div><strong>{operatorName}</strong><a href={`mailto:${supportEmail}`}>{supportEmail}</a></div>
      <a className="button secondary" href="/">Çalışma alanını aç</a>
    </footer>
  </div>;
}
