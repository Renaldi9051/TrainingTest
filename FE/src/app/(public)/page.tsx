import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { HomeSectionView, PreviewSectionFrame } from "@/components/public/home/home-sections";
import { PreviewBanner } from "@/components/public/preview-banner";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getHome, getSettings } from "@/lib/api/public";
import { getHomePreview } from "@/lib/api/preview";
import type { PreviewHomeSection, PublicHomeSection } from "@/lib/api/types";

// Data beranda dari cache bertag `home` (BE me-revalidate saat section ATAU datanya berubah).
// Draft mode (pratinjau admin): semua section, termasuk yang tersembunyi & kosong, tanpa cache.
async function loadHome(): Promise<{ sections: (PublicHomeSection | PreviewHomeSection)[]; preview: boolean }> {
  if ((await draftMode()).isEnabled) {
    const preview = await getHomePreview();
    if (preview) return { sections: preview.sections, preview: true };
  }
  return { sections: (await getHome()).sections, preview: false };
}

export async function generateMetadata(): Promise<Metadata> {
  const preview = (await draftMode()).isEnabled;
  const settings = await getSettings();
  // Judul & deskripsi beranda = default SEO situs (layout publik), tanpa template judul.
  return {
    title: { absolute: settings.seo.defaultTitle || settings.identity.name },
    alternates: { canonical: "/" },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}

const isPreviewSection = (section: PublicHomeSection | PreviewHomeSection): section is PreviewHomeSection =>
  "visible" in section;

export default async function HomePage() {
  const [{ sections, preview }, settings] = await Promise.all([loadHome(), getSettings()]);
  const hasHero = sections.some((section) => section.type === "HERO");

  return (
    <>
      {preview ? <PreviewBanner path="/" note="section tersembunyi & kosong ikut tampil" /> : null}
      {/* Satu h1 per halaman: dari hero; tanpa hero, nama situs sebagai h1 tersembunyi. */}
      {!hasHero && sections.length > 0 ? <h1 className="sr-only">{settings.identity.name}</h1> : null}

      {sections.length === 0 ? (
        <Container className="space-y-6 py-20 md:py-32">
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
            {settings.identity.name}
          </h1>
          <p className="max-w-[65ch] text-body-lg text-fg-muted">Halaman beranda sedang disiapkan.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/pelatihan" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Lihat pelatihan
            </Link>
            <Link href="/jadwal" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              Lihat jadwal
            </Link>
          </div>
        </Container>
      ) : (
        <div className="divide-y divide-border">
          {sections.map((section) =>
            preview && isPreviewSection(section) ? (
              <PreviewSectionFrame key={section.id} section={section}>
                <HomeSectionView section={section} />
              </PreviewSectionFrame>
            ) : (
              <HomeSectionView key={section.id} section={section} />
            ),
          )}
        </div>
      )}
    </>
  );
}
