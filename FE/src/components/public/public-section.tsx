import { useId, type ReactNode } from "react";
import { SectionHeading } from "@/components/public/section-heading";
import { Container } from "@/components/ui/container";
import type { LightTone } from "@/lib/section-tones";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<LightTone, string | null> = {
  default: null,
  subtle: "bg-bg-subtle",
  // -mt-px: garis atas band menutup garis pemisah section sebelumnya (divide-y beranda), jadi tidak dobel.
  warm: "-mt-px border-y border-border-warm bg-bg-warm",
};

type PublicSectionProps = {
  eyebrow: string;
  heading: string;
  // Dipakai sebagai judul h2 tersembunyi kalau heading kosong, supaya hierarki heading tetap rapi
  // (h1 halaman -> h2 section -> h3 item) untuk pembaca layar.
  fallbackHeading: string;
  intro?: string;
  // Section terbalik: CTA penutup. Permukaan navy (data-surface="cta" memetakan ulang token inverse
  // ke --cta-* di public-surfaces.css). Maksimal dua section terbalik per halaman: CTA penutup + footer
  // (DESIGN 2).
  inverse?: boolean;
  // Latar section terang (Malam Hujan v2): "default" --bg, "subtle" --bg-subtle (selang-seling), "warm"
  // band hangat --bg-warm + garis --border-warm atas-bawah (maks 1 per halaman). Ditandai data-tone,
  // jadi isi (tabel, panel) bisa menyesuaikan latar lewat varian in-data-[tone=subtle].
  tone?: LightTone;
  className?: string;
  // Elemen dekoratif di belakang isi (DESIGN.md 6): dirender sebelum isi, isi di atasnya.
  background?: ReactNode;
  // Tanpa Container & jarak section penuh: dipakai di kolom isi halaman statis (di samping daftar isi).
  bare?: boolean;
  // Anchor daftar isi.
  id?: string;
  children: ReactNode;
};

// Kerangka section publik: jarak antar section 128 px desktop / 80 px mobile (DESIGN 4).
export function PublicSection({ eyebrow, heading, fallbackHeading, intro, inverse, tone, className, background, bare, id, children }: PublicSectionProps) {
  const headingId = useId();
  if (bare) {
    return (
      <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-28 py-10 first:pt-0 md:py-12", className)}>
        <div className="space-y-6">
          {eyebrow || heading ? (
            <SectionHeading eyebrow={eyebrow} title={heading || undefined} id={heading ? headingId : undefined}>
              {intro ? <p className="max-w-[65ch] text-body-lg text-fg-muted">{intro}</p> : null}
            </SectionHeading>
          ) : null}
          {!heading ? (
            <h2 id={headingId} className="sr-only">
              {fallbackHeading}
            </h2>
          ) : null}
          {children}
        </div>
      </section>
    );
  }
  return (
    <section
      aria-labelledby={headingId}
      data-surface={inverse ? "cta" : undefined}
      data-tone={!inverse && tone && tone !== "default" ? tone : undefined}
      className={cn(
        "py-20 md:py-32",
        background ? "relative overflow-hidden" : null,
        inverse ? "bg-inverse-bg text-inverse-fg" : tone ? TONE_CLASS[tone] : null,
        className,
      )}
    >
      {background}
      <Container className="relative space-y-10 md:space-y-14">
        {eyebrow || heading ? (
          <SectionHeading eyebrow={eyebrow} title={heading || undefined} id={heading ? headingId : undefined} inverse={inverse}>
            {intro ? (
              <p className={cn("max-w-[65ch] text-body-lg", inverse ? "text-inverse-muted" : "text-fg-muted")}>{intro}</p>
            ) : null}
          </SectionHeading>
        ) : null}
        {!heading ? (
          <h2 id={headingId} className="sr-only">
            {fallbackHeading}
          </h2>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
