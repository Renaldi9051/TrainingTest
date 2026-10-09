import type { Metadata } from "next";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { getSettings } from "@/lib/api/public";
import { getPublicEnv } from "@/lib/env";

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
    icons: identity.favicon ? { icon: identity.favicon.url } : undefined,
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
    </>
  );
}
