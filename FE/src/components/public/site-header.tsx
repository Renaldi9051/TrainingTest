import Link from "next/link";
import { BrandMark } from "@/components/decor/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getNav, getSettings } from "@/lib/api/public";
import type { PublicImage } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { HeaderNav } from "./header-nav";
import { SearchTrigger } from "./search-trigger";
import { SiteLogo } from "./site-logo";

// Logo dari pengaturan; selama belum diisi: tanda viewfinder + nama situs (warna ikut header).
// Nama selalu satu baris: sedikit lebih kecil di mobile, ellipsis kalau tetap tidak muat (nama
// lengkap tetap dari aria-label link dan title).
function HeaderBrand({ logo, name, className }: { logo: PublicImage | null; name: string; className: string }) {
  return (
    <span className={cn("min-w-0 items-center gap-2.5", className)}>
      {logo ? null : <BrandMark />}
      <SiteLogo logo={logo} name={name} nameClassName="min-w-0 truncate text-[15px] sm:text-body" />
    </span>
  );
}

// Header putih sticky 72 px (DESIGN.md 4 & mockup). Di atas foto hero beranda (elemen
// [data-header-over]) header transparan berteks terang dan ikut tergulir (public.css .site-header).
// "Cari" membuka command palette (Ctrl/Cmd+K); tanpa JS tetap link ke katalog.
export async function SiteHeader() {
  const [settings, nav] = await Promise.all([getSettings(), getNav()]);
  const { identity } = settings;
  const { ctaLabel, ctaHref } = settings.header;
  const cta = ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : null;

  return (
    <header className="site-header sticky top-0 z-40 border-b border-border bg-bg/95 text-fg">
      <Container className="flex h-18 items-center gap-8">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center rounded-sm text-current outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
          aria-label={`${identity.name}, ke beranda`}
          title={identity.name}
        >
          <HeaderBrand logo={identity.logoLight} name={identity.name} className="site-brand-light flex" />
          <HeaderBrand logo={identity.logoDark} name={identity.name} className="site-brand-dark hidden" />
        </Link>
        <HeaderNav items={nav.header} cta={cta} />
        <div className="ml-auto hidden shrink-0 items-center gap-3 lg:flex">
          <SearchTrigger className="inline-flex h-10 items-center gap-2.5 rounded-md border border-(--header-line) px-3 text-small text-current outline-none transition-colors duration-150 ease-standard hover:bg-(--header-hover) focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2" />
          {cta ? (
            <Link href={cta.href} className={cn(buttonVariants({ variant: "primary", size: "md" }), "site-header-cta")}>
              {cta.label}
            </Link>
          ) : null}
        </div>
      </Container>
    </header>
  );
}
