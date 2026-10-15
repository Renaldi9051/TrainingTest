import Link from "next/link";
import type { ReactNode } from "react";
import { OutlineText } from "@/components/decor/outline-text";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

// Breadcrumb mono (DESIGN.md 3 label): Beranda / ... / halaman ini. Item terakhir = halaman aktif.
function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
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
                  className="rounded-sm outline-none transition-colors duration-150 hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong"
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

// Kepala halaman dalam (mockup .phero): breadcrumb mono, satu h1, lead di kolom kanan (desktop),
// teks outline raksasa opsional di belakang, garis bawah. Langsung terbaca tanpa reveal (layar
// pertama); stagger masuk hanya setelah navigasi klien (PageEnter, elemen data-page-enter).
// crumbs: induk setelah Beranda + halaman ini (label terakhir biasanya = judul).
export function PageHero({
  crumbs,
  eyebrow,
  title,
  lead,
  outline,
  decor = true,
  children,
}: {
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  lead?: string | null;
  // Teks outline raksasa (dari CMS/label halaman). Kosong = tanpa outline.
  outline?: string | null;
  decor?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border pt-12 pb-12 md:pt-[72px] md:pb-16">
      <OutlineText decor={decor} className="right-[-24px] bottom-[-0.12em] md:right-[-40px]">
        {outline}
      </OutlineText>
      <Container className="relative">
        <Breadcrumb crumbs={crumbs} />
        {eyebrow ? (
          <Eyebrow data-page-enter="" className="mb-4">
            {eyebrow}
          </Eyebrow>
        ) : null}
        <div className="grid gap-6 md:grid-cols-12 md:items-end md:gap-6">
          <h1
            data-page-enter=""
            className={cn("max-w-[20ch] text-h1 text-fg-strong", lead ? "md:col-span-8" : "md:col-span-10")}
          >
            {title}
          </h1>
          {lead ? (
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
