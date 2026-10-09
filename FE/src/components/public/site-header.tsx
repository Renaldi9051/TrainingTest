import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getNav, getSettings } from "@/lib/api/public";
import { HeaderNav } from "./header-nav";
import { SiteLogo } from "./site-logo";

// Search sementara mengarah ke katalog; command palette Ctrl/Cmd+K menyusul di Fase 4.
export async function SiteHeader() {
  const [settings, nav] = await Promise.all([getSettings(), getNav()]);
  const { ctaLabel, ctaHref } = settings.header;
  const cta = ctaLabel && ctaHref ? { label: ctaLabel, href: ctaHref } : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg">
      <Container className="flex h-16 items-center gap-8">
        <Link
          href="/"
          className="flex shrink-0 items-center rounded-sm text-fg-strong outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
          aria-label={`${settings.identity.name}, ke beranda`}
        >
          <SiteLogo logo={settings.identity.logoLight} name={settings.identity.name} />
        </Link>
        <HeaderNav items={nav.header} cta={cta} />
        <div className="ml-auto hidden items-center gap-6 lg:flex">
          <Link
            href="/pelatihan"
            className="inline-flex items-center gap-2 rounded-sm text-small text-fg outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
          >
            <SearchIcon className="size-4" strokeWidth={1.5} aria-hidden />
            Cari pelatihan
          </Link>
          {cta ? (
            <Link href={cta.href} className={buttonVariants({ variant: "primary", size: "sm" })}>
              {cta.label}
            </Link>
          ) : null}
        </div>
      </Container>
    </header>
  );
}
