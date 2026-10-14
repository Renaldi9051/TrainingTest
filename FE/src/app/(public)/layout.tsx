import type { Metadata } from "next";
import { PageEnter } from "@/components/motion/page-enter";
import { PointerEffects } from "@/components/motion/pointer-effects";
import { FloatingContact } from "@/components/public/floating-contact";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getSettings } from "@/lib/api/public";
import { getPublicEnv } from "@/lib/env";
import { FALLBACK_ICON_PATH } from "@/lib/monogram";

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
        className="sr-only z-50 rounded-md bg-fg-strong px-4 py-2 text-small text-inverse-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Lewati ke konten
      </a>
      <SiteHeader />
      <main id="konten" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      {/* Tombol bulat + panel daftar marketing (hanya kalau ada kontak marketing). */}
      <FloatingContact />
      {/* Efek kursor (magnetic, label & gambar ikut kursor): satu listener untuk semua halaman publik. */}
      <PointerEffects />
      {/* Header halaman stagger masuk setelah navigasi klien (bukan muat penuh atau Back/Forward). */}
      <PageEnter />
    </>
  );
}
