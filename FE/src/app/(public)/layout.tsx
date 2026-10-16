import type { Metadata } from "next";
import { GridLines } from "@/components/decor/grid-lines";
import { PageEnter } from "@/components/motion/page-enter";
import { ParallaxEffects } from "@/components/motion/parallax-effects";
import { PointerEffects } from "@/components/motion/pointer-effects";
import { FloatingContact } from "@/components/public/floating-contact";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getSettings } from "@/lib/api/public";
import { getPublicEnv } from "@/lib/env";
import { FALLBACK_ICON_PATH } from "@/lib/monogram";
// Palet C hanya untuk halaman publik: semua aturannya di-scope ke [data-site="public"] (main di bawah).
import "./palette-c.css";

// Metadata dasar seluruh halaman publik dari pengaturan SEO default (bisa diubah admin).
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const { seo, identity } = settings;
  return {
    metadataBase: new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL),
    title: { template: seo.titleTemplate, default: seo.defaultTitle },
    description: seo.description || undefined,
    openGraph: {
      siteName: identity.name,
      locale: "id_ID",
      type: "website",
      images: seo.ogImage ? [{ url: seo.ogImage.url, alt: seo.ogImage.alt ?? identity.name }] : undefined,
    },
    // Favicon dari CMS; selama kosong pakai monogram cadangan (app/icon).
    icons: { icon: identity.favicon ? identity.favicon.url : FALLBACK_ICON_PATH },
  };
}

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#konten"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-small text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Lewati ke konten
      </a>
      <SiteHeader />
      {/* isolate: garis grid (z negatif) di belakang semua isi main, tapi di atas latar halaman;
          section berlatar menutupinya seperti di mockup. */}
      {/* data-site: penanda scope palet C (palette-c.css); admin tidak punya penanda ini. */}
      <main id="konten" data-site="public" className="relative isolate flex-1">
        <GridLines className="-z-10" />
        {children}
      </main>
      <SiteFooter />
      {/* Tombol bulat + panel daftar marketing (hanya kalau ada kontak marketing). */}
      <FloatingContact />
      {/* Efek kursor (magnetic, label & gambar ikut kursor): satu listener untuk semua halaman publik. */}
      <PointerEffects />
      {/* Header halaman stagger masuk setelah navigasi klien (bukan muat penuh atau Back/Forward). */}
      <PageEnter />
      {/* Teks outline raksasa bergeser pelan mengikuti scroll (satu listener). */}
      <ParallaxEffects />
    </>
  );
}
