import { SearchIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { HeroWords, LineDraw } from "@/components/motion/reveal-parts";
import { ChipLink } from "@/components/public/chip-link";
import { ClientLogos } from "@/components/public/client-logos";
import { PublicImage } from "@/components/public/public-image";
import { PublicSection } from "@/components/public/public-section";
import { ScheduleTable } from "@/components/public/schedule-table";
import { ServiceRows } from "@/components/public/service-rows";
import { TestimonialsScroller } from "@/components/public/testimonials-scroller";
import { TrainingGrid } from "@/components/public/training-card";
import { VisionMission } from "@/components/public/vision-mission";
import { ButtonContent, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { Cta, PreviewHomeSection, PublicHomeSection } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

// Judul h2 tersembunyi untuk section tanpa judul (label UI, bukan konten).
const FALLBACK_HEADINGS: Record<PublicHomeSection["type"], string> = {
  HERO: "Beranda",
  STATS: "Statistik",
  SERVICES: "Layanan",
  CATEGORIES: "Kategori pelatihan",
  LATEST_TRAININGS: "Pelatihan terbaru",
  UPCOMING_SCHEDULES: "Jadwal terdekat",
  CLIENTS: "Klien",
  VISION_MISSION: "Visi dan misi",
  TESTIMONIALS: "Testimoni",
  CTA: "Hubungi kami",
};

const HERO_IMAGE_SIZES = "(min-width: 1280px) 1232px, calc(100vw - 32px)";

function CtaLink({ cta, variant, arrow }: { cta: Cta; variant: "primary" | "secondary" | "inverse" | "inverseOutline"; arrow?: boolean }) {
  const external = /^https:\/\//i.test(cta.href);
  const className = buttonVariants({ variant, size: "lg" });
  const content = <ButtonContent arrow={arrow}>{cta.label}</ButtonContent>;
  return external ? (
    <a href={cta.href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
      <span className="sr-only"> (tab baru)</span>
    </a>
  ) : (
    <Link href={cta.href} className={className}>
      {content}
    </Link>
  );
}

function SectionCta({ cta }: { cta: Cta | null }) {
  return cta ? (
    <div>
      <CtaLink cta={cta} variant="secondary" arrow />
    </div>
  ) : null;
}

// Konten layar pertama: langsung terbaca tanpa reveal scroll (DESIGN 8.3). Satu-satunya h1 beranda.
// Hanya h1 yang bergerak: kata naik dengan CSS murni <= 500 ms (tanpa JS, tanpa opacity 0).
// Subjudul, search, dan CTA tidak dianimasikan.
function HeroSection({ section }: { section: Extract<PublicHomeSection, { type: "HERO" }> }) {
  const word = section.rotatingWords[0];
  return (
    <section className="py-20 md:py-32" aria-labelledby={`${section.id}-title`}>
      <Container className="space-y-10 md:space-y-14">
        <div className="space-y-6">
          {section.eyebrow ? <Eyebrow>{section.eyebrow}</Eyebrow> : null}
          <h1
            id={`${section.id}-title`}
            className="max-w-[16ch] text-[48px] leading-[0.95] font-semibold tracking-[-0.04em] text-fg-strong md:text-[88px]"
          >
            {/* Kata kunci pertama ikut reveal; pergantian kata (RotatingWord) menyusul di 4.1d. */}
            <HeroWords text={section.headline} accent={word} />
          </h1>
          {section.subheadline ? (
            <p className="max-w-[65ch] text-body-lg text-fg-muted">{section.subheadline}</p>
          ) : null}
        </div>

        {section.showSearch ? (
          <form action="/pelatihan" method="get" role="search" className="max-w-2xl space-y-2">
            <label htmlFor={`${section.id}-search`} className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
              Cari pelatihan
            </label>
            <div className="flex gap-2">
              <input
                id={`${section.id}-search`}
                name="q"
                type="search"
                placeholder={section.searchPlaceholder || undefined}
                className="h-12 min-w-0 flex-1 rounded-md border border-border-strong bg-bg px-4 text-body text-fg outline-none placeholder:text-fg-subtle focus-visible:border-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
              />
              <button type="submit" className={buttonVariants({ variant: "primary", size: "lg" })}>
                <SearchIcon aria-hidden strokeWidth={1.5} />
                <span className="sr-only sm:not-sr-only">Cari</span>
              </button>
            </div>
          </form>
        ) : null}

        {section.primaryCta || section.secondaryCta ? (
          <div className="flex flex-wrap gap-3">
            {section.primaryCta ? <CtaLink cta={section.primaryCta} variant="primary" arrow /> : null}
            {section.secondaryCta ? <CtaLink cta={section.secondaryCta} variant="secondary" /> : null}
          </div>
        ) : null}

        {section.image ? (
          <div className="relative aspect-video overflow-hidden bg-bg-muted">
            {/* Gambar di layar pertama: dimuat lebih dulu (LCP). */}
            <PublicImage image={section.image} sizes={HERO_IMAGE_SIZES} priority />
          </div>
        ) : null}
      </Container>
    </section>
  );
}

function StatsSection({ section }: { section: Extract<PublicHomeSection, { type: "STATS" }> }) {
  return (
    <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.STATS}>
      <Reveal>
        <LineDraw />
        <dl data-reveal-children="item" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {section.items.map((item, index) => (
            <div key={index} className="space-y-2 border-b border-border py-8 pr-6">
              {/* Counter berjalan menyusul di Fase 4; angka final tampil langsung. */}
              <dd className="font-mono text-[36px] leading-none font-medium text-fg-strong md:text-[48px]">
                {item.prefix}
                {formatNumber(item.value)}
                {item.suffix}
              </dd>
              <dt className="text-small text-fg-muted">{item.label}</dt>
            </div>
          ))}
        </dl>
      </Reveal>
    </PublicSection>
  );
}

function CtaSection({ section }: { section: Extract<PublicHomeSection, { type: "CTA" }> }) {
  return (
    <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.CTA} intro={section.body} inverse>
      <div className="flex flex-wrap gap-3">
        <CtaLink cta={section.primaryCta} variant="inverse" arrow />
        {section.secondaryCta ? <CtaLink cta={section.secondaryCta} variant="inverseOutline" /> : null}
      </div>
    </PublicSection>
  );
}

export function HomeSectionView({ section }: { section: PublicHomeSection }): ReactNode {
  switch (section.type) {
    case "HERO":
      return <HeroSection section={section} />;
    case "STATS":
      return <StatsSection section={section} />;
    case "SERVICES":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.SERVICES} intro={section.intro}>
          <ServiceRows services={section.items} />
          <SectionCta cta={section.cta} />
        </PublicSection>
      );
    case "CATEGORIES":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.CATEGORIES} intro={section.intro}>
          <Reveal as="ul" data-reveal-children="pop" className="flex flex-wrap gap-2">
            {section.items.map((category) => (
              <li key={category.slug}>
                <ChipLink href={`/pelatihan/kategori/${category.slug}`} active={false} scroll>
                  {category.name}
                  <span className="ml-2 font-mono text-label text-fg-muted">{formatNumber(category.trainingCount)}</span>
                </ChipLink>
              </li>
            ))}
          </Reveal>
          <SectionCta cta={section.cta} />
        </PublicSection>
      );
    case "LATEST_TRAININGS":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.LATEST_TRAININGS} intro={section.intro}>
          <TrainingGrid trainings={section.items} />
          <SectionCta cta={section.cta} />
        </PublicSection>
      );
    case "UPCOMING_SCHEDULES":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.UPCOMING_SCHEDULES} intro={section.intro}>
          <ScheduleTable rows={section.items} caption={section.heading || FALLBACK_HEADINGS.UPCOMING_SCHEDULES} showTraining />
          <SectionCta cta={section.cta} />
        </PublicSection>
      );
    case "CLIENTS":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.CLIENTS} intro={section.intro}>
          <ClientLogos clients={section.items} />
        </PublicSection>
      );
    case "VISION_MISSION":
      return (
        <PublicSection eyebrow={section.eyebrow} heading="" fallbackHeading={FALLBACK_HEADINGS.VISION_MISSION}>
          <VisionMission vision={section.vision} mission={section.mission} motto={section.motto} />
        </PublicSection>
      );
    case "TESTIMONIALS":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.TESTIMONIALS} intro={section.intro}>
          <TestimonialsScroller testimonials={section.items} label={section.heading || FALLBACK_HEADINGS.TESTIMONIALS} />
        </PublicSection>
      );
    case "CTA":
      return <CtaSection section={section} />;
  }
}

// Penanda pratinjau di atas section: tersembunyi dan/atau kosong (tidak tampil di publik).
export function PreviewSectionFrame({ section, children }: { section: PreviewHomeSection; children: ReactNode }) {
  const markers = [
    !section.visible ? "Tersembunyi · tidak tampil di publik" : null,
    section.empty ? "Kosong · belum ada data, tidak tampil di publik" : null,
  ].filter(Boolean);
  if (markers.length === 0) return <>{children}</>;
  return (
    <div className={cn("relative border-y border-dashed border-border-strong", !section.visible && "opacity-60")}>
      <Container className="pt-4">
        <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-strong">{markers.join(" · ")}</p>
      </Container>
      {section.empty ? (
        <Container className="py-10">
          <p className="text-small text-fg-muted">{FALLBACK_HEADINGS[section.type]}: section ini kosong.</p>
        </Container>
      ) : (
        children
      )}
    </div>
  );
}
