import { useId, type ReactNode } from "react";
import { SectionHeading } from "@/components/public/section-heading";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

type PublicSectionProps = {
  eyebrow: string;
  heading: string;
  // Dipakai sebagai judul h2 tersembunyi kalau heading kosong, supaya hierarki heading tetap rapi
  // (h1 halaman -> h2 section -> h3 item) untuk pembaca layar.
  fallbackHeading: string;
  intro?: string;
  // Section terbalik (hitam). Maksimal dua per halaman: CTA penutup + footer (DESIGN 2).
  inverse?: boolean;
  className?: string;
  // Elemen dekoratif di belakang isi (DESIGN.md 6): dirender sebelum isi, isi di atasnya.
  background?: ReactNode;
  children: ReactNode;
};

// Kerangka section publik: jarak antar section 128 px desktop / 80 px mobile (DESIGN 4).
export function PublicSection({ eyebrow, heading, fallbackHeading, intro, inverse, className, background, children }: PublicSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn("py-20 md:py-32", background ? "relative overflow-hidden" : null, inverse && "bg-inverse-bg text-inverse-fg", className)}
    >
      {background}
      <Container className="relative space-y-10 md:space-y-14">
        {eyebrow || heading ? (
          <SectionHeading eyebrow={eyebrow} title={heading || undefined} id={heading ? headingId : undefined} inverse={inverse}>
            {intro ? (
              <p className={cn("max-w-[65ch] text-body-lg", inverse ? "text-inverse-fg/80" : "text-fg-muted")}>{intro}</p>
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
