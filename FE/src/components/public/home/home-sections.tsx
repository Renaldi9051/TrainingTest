import { outlineLabel } from "@/lib/outline-label";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DotPattern } from "@/components/decor/dot-pattern";
import { GrainOverlay } from "@/components/decor/grain-overlay";
import { OutlineText } from "@/components/decor/outline-text";
import { PlusMarker } from "@/components/decor/plus-marker";
import { RotatingBadge } from "@/components/decor/rotating-badge";
import { HeroPauseButton } from "@/components/motion/hero-pause-button";
import { HeroSlideshow } from "@/components/motion/hero-slideshow";
import { Reveal } from "@/components/motion/reveal";
import { HeroWords } from "@/components/motion/hero-words";
import { CountUp, LineDraw } from "@/components/motion/reveal-parts";
import { VelocityMarquee } from "@/components/motion/velocity-marquee";
import { ChipLink } from "@/components/public/chip-link";
import { ClientLogos } from "@/components/public/client-logos";
import { PublicSection } from "@/components/public/public-section";
import { ScheduleTable } from "@/components/public/schedule-table";
import { ServiceRows } from "@/components/public/service-rows";
import { TestimonialsScroller } from "@/components/public/testimonials-scroller";
import { TrainingGrid } from "@/components/public/training-card";
import { VisionMission } from "@/components/public/vision-mission";
import { ButtonContent, buttonVariants, MAGNETIC } from "@/components/ui/button";
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
  MARQUEE: "Bidang layanan",
};

function CtaLink({ cta, variant, arrow }: { cta: Cta; variant: "primary" | "secondary" | "inverse" | "inverseOutline"; arrow?: boolean }) {
  const external = /^https:\/\//i.test(cta.href);
  const className = buttonVariants({ variant, size: "lg" });
  const content = (
    <ButtonContent arrow={arrow} roll>
      {cta.label}
    </ButtonContent>
  );
  return external ? (
    <a href={cta.href} target="_blank" rel="noopener noreferrer" className={className} {...MAGNETIC}>
      {content}
      <span className="sr-only"> (tab baru)</span>
    </a>
  ) : (
    <Link href={cta.href} className={className} {...MAGNETIC}>
      {content}
    </Link>
  );
}


// Tanda + di keempat sudut sebuah blok (DESIGN.md 6.1). Induk relative.
function CornerMarkers({ decor, inset = "-top-1.5" }: { decor: boolean; inset?: string }) {
  if (!decor) return null;
  return (
    <>
      <PlusMarker className={cn(inset, "-left-1.5")} />
      <PlusMarker className={cn(inset, "-right-1.5")} />
    </>
  );
}

function SectionCta({ cta }: { cta: Cta | null }) {
  return cta ? (
    <div>
      <CtaLink cta={cta} variant="secondary" arrow />
    </div>
  ) : null;
}

type HeroData = Extract<PublicHomeSection, { type: "HERO" }>;

// Teks hero (eyebrow, h1, subjudul, search, CTA). Konten layar pertama: langsung terbaca tanpa reveal
// scroll (DESIGN 9.3). Satu-satunya h1 beranda. Saat muat penuh hanya h1 yang bergerak: kata naik
// dengan CSS murni <= 500 ms (tanpa JS, tanpa opacity 0). Setelah navigasi klien, eyebrow dan subjudul
// ikut stagger masuk (PageEnter). inverse: di atas foto (teks terang).
function HeroText({ section, inverse, aside }: { section: HeroData; inverse: boolean; aside?: ReactNode }) {
  const muted = inverse ? "text-inverse-fg/85" : "text-fg-muted";
  return (
    <div className="space-y-8 md:space-y-10">
      <div className="space-y-5 md:space-y-6">
        {section.eyebrow ? (
          <Eyebrow data-page-enter="" className={muted}>
            {section.eyebrow}
          </Eyebrow>
        ) : null}
        <h1 id={`${section.id}-title`} className={cn("max-w-[16ch] text-display", inverse ? "text-inverse-fg" : "text-fg-strong")}>
          {/* Kata kunci berganti tiap 2 s (RotatingWord), ikut tombol pause hero. */}
          <HeroWords
            text={section.headline}
            accents={section.rotatingWords}
            accentClassName={inverse ? "italic font-medium" : "text-fg-muted"}
          />
        </h1>
        {section.subheadline ? (
          <p data-page-enter="" className={cn("max-w-[52ch] text-body-lg", inverse ? "text-inverse-fg/90" : "text-fg-muted")}>
            {section.subheadline}
          </p>
        ) : null}
      </div>

      {section.showSearch || section.primaryCta || section.secondaryCta || aside ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          {section.showSearch ? (
            <form action="/pelatihan" method="get" role="search" className="w-full max-w-[460px] space-y-2">
              <label htmlFor={`${section.id}-search`} className={cn("block font-mono text-label uppercase tracking-[0.08em]", muted)}>
                Cari pelatihan
              </label>
              {/* Cincin fokus di wrapper (input tanpa outline sendiri), terlihat juga di atas foto hero. */}
              <div
                className={cn(
                  "flex h-14 items-center gap-2 rounded-md pr-1.5 pl-4 focus-within:ring-2 focus-within:ring-offset-2",
                  inverse
                    ? "bg-bg text-fg focus-within:ring-inverse-fg focus-within:ring-offset-fg-strong"
                    : "border border-border-strong bg-bg focus-within:border-fg-strong focus-within:ring-fg-strong",
                )}
              >
                <SearchIcon aria-hidden strokeWidth={1.5} className="size-5 shrink-0 text-fg-muted" />
                <input
                  id={`${section.id}-search`}
                  name="q"
                  type="search"
                  placeholder={section.searchPlaceholder || undefined}
                  className="h-full min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
                />
                <button type="submit" className={cn(buttonVariants({ variant: "primary", size: "md" }), "h-11")}>
                  Cari
                </button>
              </div>
            </form>
          ) : null}
          {section.primaryCta ? <CtaLink cta={section.primaryCta} variant={inverse ? "inverse" : "primary"} arrow /> : null}
          {section.secondaryCta ? <CtaLink cta={section.secondaryCta} variant={inverse ? "inverseOutline" : "secondary"} /> : null}
          {aside}
        </div>
      ) : null}
    </div>
  );
}

function heroBadge(section: HeroData): { text: string; href: string } | null {
  return section.showBadge && section.badgeText && section.badgeHref ? { text: section.badgeText, href: section.badgeHref } : null;
}

// Hero tanpa slide (DESIGN.md 8.1, keputusan pemilik): hero teks di latar putih, header tetap putih.
// Decor tanpa gambar (maks 2): pola titik di belakang teks + tanda plus di sudut (atau badge berputar
// kalau diaktifkan admin). Kata berganti tetap punya tombol pause.
function TextHero({ section }: { section: HeroData }) {
  const badge = heroBadge(section);
  const words = section.rotatingWords.filter((word) => word.trim()).length;
  return (
    <section className="relative overflow-hidden py-20 md:py-32" aria-labelledby={`${section.id}-title`}>
      <DotPattern decor={section.decor} />
      <Container className="relative">
        {badge ? (
          <RotatingBadge decor={section.decor} href={badge.href} text={badge.text} tone="dark" className="right-4 bottom-0 sm:right-6" />
        ) : (
          <>
            {/* Di atas blok teks (tidak menimpa eyebrow), segaris dengan tepi konten. */}
            <PlusMarker decor={section.decor} className="-top-12 left-2.5 sm:left-4.5" />
            <PlusMarker decor={section.decor} className="-top-12 right-2.5 sm:right-4.5" />
          </>
        )}
        <HeroText
          section={section}
          inverse={false}
          aside={words > 1 ? <HeroPauseButton subject="kata berganti" className="border-border-strong text-fg hover:bg-bg-subtle sm:ml-auto" /> : null}
        />
      </Container>
    </section>
  );
}

function HeroSection({ section }: { section: HeroData }) {
  if (section.slides.length === 0) return <TextHero section={section} />;
  const full = section.layout === "fullbleed";
  const text = <HeroText section={section} inverse={full} />;
  return (
    <HeroSlideshow
      slides={section.slides}
      intervalMs={section.intervalMs}
      layout={section.layout}
      photoStyle={section.photoStyle}
      showViewfinder={section.showViewfinder}
      decor={section.decor}
      badge={heroBadge(section)}
      hasRotatingWords={section.rotatingWords.filter((word) => word.trim()).length > 1}
    >
      {full ? <Container>{text}</Container> : text}
    </HeroSlideshow>
  );
}

// Statistik (DESIGN.md 8.6): angka besar mono dipisah garis vertikal, tanda + di sudut tiap angka,
// counter berjalan saat masuk layar. Label HUD tidak dipakai: belum ada data CMS untuknya (6.2).
function StatsSection({ section }: { section: Extract<PublicHomeSection, { type: "STATS" }> }) {
  return (
    <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.STATS}>
      <Reveal>
        <LineDraw />
        <dl data-reveal-children="item" className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
          {section.items.map((item, index) => (
            <div
              key={index}
              className={cn(
                "relative flex flex-col gap-3 px-4 pt-8 pb-7 md:px-6 md:pt-10",
                index % 2 === 1 && "border-l border-border",
                index >= 2 && "border-t border-border lg:border-t-0",
                index % 4 !== 0 && "lg:border-l",
              )}
            >
              {section.decor ? <PlusMarker className="-top-1.5 -left-1.5" /> : null}
              {/* Counter berjalan saat grup masuk viewport (hanya kalau seluruhnya di bawah layar awal). */}
              <dd className="order-1 font-mono text-[40px] leading-none font-medium tracking-[-0.04em] text-fg-strong md:text-[64px]">
                {item.prefix}
                <CountUp value={item.value} display={formatNumber(item.value)} />
                {item.suffix}
              </dd>
              <dt className="order-2 text-body text-fg">{item.label}</dt>
            </div>
          ))}
        </dl>
      </Reveal>
    </PublicSection>
  );
}

// Teks besar berjalan mengikuti scroll (VelocityMarquee). Solid dan outline berselang-seling; salinan
// kedua membalik pola supaya setiap item pernah tampil solid (juga kalau jumlahnya genap). Pembaca
// layar: h2 sr-only + daftar teks sekali (salinan kedua aria-hidden). Reduced motion: teks dibungkus
// ke beberapa baris, tanpa gerak.
function MarqueeSection({ section }: { section: Extract<PublicHomeSection, { type: "MARQUEE" }> }) {
  const titleId = `${section.id}-title`;
  const list = (startOutline: boolean) => (
    <ul className="flex motion-reduce:flex-wrap">
      {section.items.map((item, index) => (
        <li
          key={`${index}-${item}`}
          data-marquee-style={(index % 2 === 1) !== startOutline ? "outline" : "solid"}
          className="marquee-text whitespace-nowrap pr-[0.3em]"
        >
          {item}
          <span aria-hidden className="pl-[0.3em] text-fg-muted [-webkit-text-stroke:0]">
            ·
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-labelledby={titleId} className="py-16 md:py-24">
      <h2 id={titleId} className="sr-only">
        {section.heading || FALLBACK_HEADINGS.MARQUEE}
      </h2>
      <VelocityMarquee listClassName="motion-reduce:w-full motion-reduce:px-4" copy={list(true)}>
        {list(false)}
      </VelocityMarquee>
    </section>
  );
}

// CTA penutup (DESIGN.md 8.9): section hitam + grain + teks outline (bergeser pelan). Badge berputar
// tidak dipakai: belum ada teks badge di CMS untuk section ini.
function CtaSection({ section }: { section: Extract<PublicHomeSection, { type: "CTA" }> }) {
  return (
    <PublicSection
      eyebrow={section.eyebrow}
      heading={section.heading}
      fallbackHeading={FALLBACK_HEADINGS.CTA}
      intro={section.body}
      inverse
      background={
        section.decor ? (
          <>
            <GrainOverlay tone="inverse" />
            <OutlineText tone="inverse" parallax className="-bottom-[0.12em] -left-6 md:-left-10">
              {outlineLabel(section.eyebrow)}
            </OutlineText>
          </>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-3">
        <CtaLink cta={section.primaryCta} variant="inverse" arrow />
        {section.secondaryCta ? <CtaLink cta={section.secondaryCta} variant="inverseOutline" /> : null}
      </div>
    </PublicSection>
  );
}

// Nama kategori berjalan sebagai pemisah setelah section Kategori (DESIGN.md 13), mengikuti kecepatan
// scroll. Dekoratif: nama yang sama sudah ada sebagai chip, jadi disembunyikan dari pembaca layar.
// Reduced motion: tidak ditampilkan (daftar statis tidak menambah informasi).
function CategoryMarquee({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  const list = (
    <ul className="flex">
      {names.map((name, index) => (
        <li key={`${index}-${name}`} className="flex items-center whitespace-nowrap">
          <span className="px-6 text-[40px] leading-none font-semibold tracking-[-0.03em] text-fg-strong md:px-7 md:text-[56px]">{name}</span>
          <span className="text-[24px] text-fg-subtle md:text-[32px]">✦</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div aria-hidden className="border-y border-border py-6 motion-reduce:hidden md:py-7">
      <VelocityMarquee>{list}</VelocityMarquee>
    </div>
  );
}

export function HomeSectionView({ section }: { section: PublicHomeSection }): ReactNode {
  switch (section.type) {
    case "HERO":
      return <HeroSection section={section} />;
    case "STATS":
      return <StatsSection section={section} />;
    case "SERVICES":
      // Nomor raksasa + teks outline (bergeser pelan) di belakang (DESIGN.md 8.5).
      return (
        <PublicSection
          eyebrow={section.eyebrow}
          heading={section.heading}
          fallbackHeading={FALLBACK_HEADINGS.SERVICES}
          intro={section.intro}
          background={
            // Kanan bawah, di samping tombol: tidak menimpa judul section yang panjang.
            <OutlineText decor={section.decor} parallax className="-right-6 bottom-6 md:-right-16 md:bottom-10">
              {outlineLabel(section.eyebrow)}
            </OutlineText>
          }
        >
          <ServiceRows services={section.items} decor={section.decor} />
          <SectionCta cta={section.cta} />
        </PublicSection>
      );
    case "CATEGORIES":
      // Latar abu + pola titik, lalu nama kategori berjalan sebagai pemisah (DESIGN.md 8.7 & 13).
      return (
        <>
          <PublicSection
            eyebrow={section.eyebrow}
            heading={section.heading}
            fallbackHeading={FALLBACK_HEADINGS.CATEGORIES}
            intro={section.intro}
            className="bg-bg-subtle"
            background={<DotPattern decor={section.decor} />}
          >
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
          {section.decor ? <CategoryMarquee names={section.items.map((category) => category.name)} /> : null}
        </>
      );
    case "LATEST_TRAININGS":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.LATEST_TRAININGS} intro={section.intro}>
          {/* Tanda + di sudut grid (DESIGN.md 13). */}
          <div className="relative">
            <CornerMarkers decor={section.decor} inset="-top-5" />
            <TrainingGrid trainings={section.items} />
            <CornerMarkers decor={section.decor} inset="-bottom-5" />
          </div>
          <SectionCta cta={section.cta} />
        </PublicSection>
      );
    case "UPCOMING_SCHEDULES":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.UPCOMING_SCHEDULES} intro={section.intro}>
          <ScheduleTable rows={section.items} caption={section.heading || FALLBACK_HEADINGS.UPCOMING_SCHEDULES} showTraining bigDate={section.decor} />
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
        // Kolase gambar (DESIGN.md 13) butuh gambar milik section ini; belum ada, jadi tanda + saja (aturan
        // konten 6: tanpa placeholder).
        <PublicSection eyebrow={section.eyebrow} heading="" fallbackHeading={FALLBACK_HEADINGS.VISION_MISSION} className="bg-bg-subtle">
          <div className="relative">
            <CornerMarkers decor={section.decor} />
            <VisionMission vision={section.vision} mission={section.mission} motto={section.motto} />
          </div>
        </PublicSection>
      );
    case "TESTIMONIALS":
      return (
        <PublicSection eyebrow={section.eyebrow} heading={section.heading} fallbackHeading={FALLBACK_HEADINGS.TESTIMONIALS} intro={section.intro}>
          <TestimonialsScroller testimonials={section.items} label={section.heading || FALLBACK_HEADINGS.TESTIMONIALS} decor={section.decor} />
        </PublicSection>
      );
    case "CTA":
      return <CtaSection section={section} />;
    case "MARQUEE":
      return <MarqueeSection section={section} />;
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
