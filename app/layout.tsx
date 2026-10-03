import type { Metadata } from "next";
import "./globals.css";
import "./ads-automation.css";
export const metadata: Metadata = {
  title: "Fark AI Marketing | Pazarlama Kontrol Merkezi",
  description: "Fark Yazılım için SEO, Google Ads, görev ve AI rapor yönetimi.",
  robots: { index: false, follow: false }
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="tr"><body>{children}</body></html>;
}
