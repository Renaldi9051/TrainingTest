import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { FALLBACK_ICON_PATH } from "@/lib/monogram";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
