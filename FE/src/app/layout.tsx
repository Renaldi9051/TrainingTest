import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FALLBACK_ICON_PATH } from "@/lib/monogram";
import "./public.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Tanpa preload: font mono hanya untuk label & angka, bukan elemen LCP (h1). Preload-nya berebut
// bandwidth dengan CSS render-blocking di jaringan lambat. Fallback metrik (adjustFontFallback)
// menjaga CLS saat font tertukar.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

// Favicon cadangan untuk semua halaman (termasuk admin); layout publik menimpanya dengan favicon CMS.
export const metadata: Metadata = {
  icons: { icon: FALLBACK_ICON_PATH },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
