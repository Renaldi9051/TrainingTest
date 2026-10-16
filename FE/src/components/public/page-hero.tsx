import Link from "next/link";
import type { ReactNode } from "react";
import { DotPattern } from "@/components/decor/dot-pattern";
import { OutlineText } from "@/components/decor/outline-text";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

// Breadcrumb mono (DESIGN.md 3 label): Beranda / ... / halaman ini. Item terakhir = halaman aktif.
export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const all: Crumb[] = [{ label: "Beranda", href: "/" }, ...crumbs];
  return (
    <nav aria-label="Breadcrumb" data-page-enter="" className="mb-8 md:mb-10">
      <ol className="flex flex-wrap items-center gap-2 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted">
        {all.map((crumb, index) => {
          const last = index === all.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {last || !crumb.href ? (
                <span aria-current={last ? "page" : undefined} className={cn(last && "text-fg-strong")}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="rounded-sm outline-none transition-colors duration-150 hover:text-accent-ink focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// Kepala halaman dalam (mockup .phero; palet C: latar --bg-subtle): breadcrumb mono, satu h1, lead di kolom kanan (desktop),
// teks outline raksasa opsional di belakang, garis bawah. Langsung terbaca tanpa reveal (layar
// pertama); stagger masuk hanya setelah navigasi klien (PageEnter, elemen data-page-enter).
// crumbs: induk setelah Beranda + halaman ini (label terakhir biasanya = judul).
// aside: isi kolom kanan (mis. kotak cari katalog); lead lalu pindah ke bawah judul.
// dots: pola titik di latar (DESIGN.md 6.1, satu section per halaman).
export function PageHero({
  crumbs,
  eyebrow,
  title,
  lead,
  outline,
  aside,
  dots = false,
  decor = true,
  className,
  children,
}: {
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  lead?: string | null;
  // Teks outline raksasa (dari CMS/label halaman). Kosong = tanpa outline.
  outline?: string | null;
  aside?: ReactNode;
  dots?: boolean;
  decor?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    // Mobile dengan outline: ruang bawah lebih tinggi supaya outline (96 px) tidak menimpa teks
    // (DESIGN.md 6.2: tidak di belakang paragraf).
    <section
      className={cn(
        "relative overflow-hidden border-b border-border bg-bg-subtle pt-12 md:pt-18 md:pb-16",
        outline?.trim() && decor ? "pb-24" : "pb-12",
        className,
      )}
    >
      {dots ? <DotPattern decor={decor} /> : null}
      <OutlineText decor={decor} className="-right-6 bottom-[-0.12em] md:-right-10">
        {outline}
      </OutlineText>
      <Container className="relative z-[1]">
        <Breadcrumb crumbs={crumbs} />
        {eyebrow ? (
          <Eyebrow data-page-enter="" className="mb-4">
            {eyebrow}
          </Eyebrow>
        ) : null}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-end md:gap-6">
          {aside ? (
            <>
              <div className="md:col-span-7">
                <h1 data-page-enter="" className="max-w-[20ch] text-h1 text-fg-strong">
                  {title}
                </h1>
                {lead ? (
                  <p data-page-enter="" className="mt-4 max-w-[65ch] text-body-lg text-fg-muted">
                    {lead}
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-5 lg:col-span-5 lg:col-start-8">{aside}</div>
            </>
          ) : (
            <h1
              data-page-enter=""
              className={cn("max-w-[20ch] text-h1 text-fg-strong", lead ? "md:col-span-8" : "md:col-span-10")}
            >
              {title}
            </h1>
          )}
          {lead && !aside ? (
            <p data-page-enter="" className="max-w-[65ch] text-body-lg text-fg-muted md:col-span-4 md:col-start-9 lg:col-span-3 lg:col-start-10">
              {lead}
            </p>
          ) : null}
        </div>
        {children}
      </Container>
    </section>
  );
}
