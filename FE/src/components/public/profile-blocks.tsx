import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import { createElement, useId, type ReactNode } from "react";
import { DotPattern } from "@/components/decor/dot-pattern";
import { HudLabel } from "@/components/decor/hud-label";
import { IndexNumber } from "@/components/decor/index-number";
import { OutlineText } from "@/components/decor/outline-text";
import { PlusMarker } from "@/components/decor/plus-marker";
import { Viewfinder } from "@/components/decor/viewfinder";
import { Reveal } from "@/components/motion/reveal";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RollText } from "@/components/motion/roll-text";
import { PaymentAccounts } from "@/components/public/payment-accounts";
import { PublicImage } from "@/components/public/public-image";
import { PublicSection } from "@/components/public/public-section";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceRows } from "@/components/public/service-rows";
import { ButtonArrow, buttonVariants, MAGNETIC } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { PublicPageBlock } from "@/lib/api/types";
import { categoryIcon } from "@/lib/category-icons";
import { formatBytes } from "@/lib/format";
import { outlineLabel } from "@/lib/outline-label";
import { groupProfileBlocks } from "@/lib/profile-blocks-plan";
import { cn } from "@/lib/utils";

// Halaman profil (mockup profil.html): blok yang SUDAH ADA dipetakan ke tata letak mockup tanpa
// mengubah isi atau urutannya. Bagian mockup yang datanya tidak ada (info berdiri/legalitas, foto
// besar tanpa blok gambar, gambar panel unduhan) tidak dirender. Halaman statis tetap PageBlocks.

type Block = PublicPageBlock;
type ListBlock = Extract<Block, { type: "LIST" }>;

// Judul h2 tersembunyi untuk blok tanpa judul (label UI, bukan konten).
const FALLBACK_HEADINGS: Record<Block["type"], string> = {
  RICH_TEXT: "Informasi",
  VISION_MISSION: "Visi dan misi",
  FEATURES: "Keunggulan",
  LIST: "Daftar",
  SERVICES: "Layanan",
  IMAGE: "Gambar",
  DOWNLOAD: "Unduhan",
  PAYMENT_ACCOUNTS: "Rekening pembayaran",
};

const pad = (value: number) => String(value).padStart(2, "0");

export function ProfileBlocks({
  blocks,
  categoryHrefs,
}: {
  blocks: Block[];
  // Nama kategori (huruf kecil) -> landing kategori; chip yang namanya cocok jadi tautan.
  categoryHrefs: Map<string, string>;
}) {
  return (
    <div>
      {groupProfileBlocks(blocks).map((item) =>
        item.kind === "lists" ? (
          <ListPair key={item.lists.map((list) => list.id).join("-")} lists={item.lists} categoryHrefs={categoryHrefs} />
        ) : (
          <ProfileBlock key={item.block.id} block={item.block} categoryHrefs={categoryHrefs} />
        ),
      )}
    </div>
  );
}

function ProfileBlock({ block, categoryHrefs }: { block: Block; categoryHrefs: Map<string, string> }) {
  switch (block.type) {
    case "RICH_TEXT":
      return <AboutSection block={block} />;
    case "SERVICES":
      return block.items.length > 0 ? (
        <PublicSection
          eyebrow={block.eyebrow}
          heading={block.heading}
          fallbackHeading={FALLBACK_HEADINGS.SERVICES}
          intro={block.intro}
          className="border-t border-border"
        >
          <ServiceRows services={block.items} />
        </PublicSection>
      ) : null;
    case "VISION_MISSION":
      return <DirectionSection block={block} />;
    case "FEATURES":
      return <FeaturesSection block={block} />;
    case "LIST":
      return <ListPair lists={[block]} categoryHrefs={categoryHrefs} />;
    case "IMAGE":
      return <PhotoBlock block={block} />;
    case "DOWNLOAD":
      return <DownloadSection block={block} />;
    case "PAYMENT_ACCOUNTS":
      return <PaymentSection block={block} />;
  }
}

function HeadingOrHidden({ id, eyebrow, heading, fallback }: { id: string; eyebrow: string; heading: string; fallback: string }) {
  return (
    <>
      {eyebrow || heading ? <SectionHeading eyebrow={eyebrow} title={heading || undefined} id={heading ? id : undefined} /> : null}
      {!heading ? (
        <h2 id={id} className="sr-only">
          {fallback}
        </h2>
      ) : null}
    </>
  );
}

// 01 / Tentang kami: judul di kiri (4 kolom), isi di kanan (7 kolom).
function AboutSection({ block }: { block: Extract<Block, { type: "RICH_TEXT" }> }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-t border-border py-20 first:border-t-0 md:py-32">
      <Container className="grid gap-8 md:grid-cols-12 md:gap-6">
        <div className="md:col-span-4">
          <HeadingOrHidden id={id} eyebrow={block.eyebrow} heading={block.heading} fallback={FALLBACK_HEADINGS.RICH_TEXT} />
        </div>
        <RichTextHtml html={block.bodyHtml} className="max-w-[65ch] text-body-lg text-fg md:col-span-7 md:col-start-6" />
      </Container>
    </section>
  );
}

// Visi, misi, moto: tiga kolom bernomor dengan tanda + di sudut, latar subtle.
function DirectionSection({ block }: { block: Extract<Block, { type: "VISION_MISSION" }> }) {
  const id = useId();
  const columns: { label: string; content: ReactNode }[] = [
    { label: "Visi", content: <p className="max-w-[40ch] text-body text-fg-muted">{block.vision}</p> },
    ...(block.mission.length > 0
      ? [
          {
            label: "Misi",
            content: (
              <ol className="space-y-3">
                {block.mission.map((item, index) => (
                  <li key={index} className="grid grid-cols-[2rem_1fr] gap-2 text-body text-fg-muted">
                    <span aria-hidden className="font-mono text-small text-fg-subtle">
                      {pad(index + 1)}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            ),
          },
        ]
      : []),
    ...(block.motto
      ? [{ label: "Moto", content: <p className="text-[24px] leading-[1.3] font-medium tracking-[-0.02em] text-fg-strong">“{block.motto}”</p> }]
      : []),
  ];
  return (
    <section aria-labelledby={id} className="bg-bg-subtle py-20 md:py-28">
      <Container className="space-y-12 md:space-y-14">
        <HeadingOrHidden id={id} eyebrow={block.eyebrow} heading="" fallback={FALLBACK_HEADINGS.VISION_MISSION} />
        <Reveal as="div" data-reveal-children="card" className={cn("grid gap-12 md:gap-6", columns.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {columns.map((column, index) => (
            <div key={column.label} className="relative border-t border-border-strong pt-6">
              <PlusMarker className="-top-1.5 -left-1.5" />
              {index === columns.length - 1 ? <PlusMarker className="-top-1.5 -right-1.5" /> : null}
              <IndexNumber position={index + 1} className="text-[32px] md:text-[40px]" />
              <h3 className="mt-6 mb-3 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong">{column.label}</h3>
              {column.content}
            </div>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}

function FeatureIcon({ name }: { name: string | null }) {
  const icon = categoryIcon(name);
  return icon ? createElement(icon, { className: "size-5 shrink-0 text-fg-strong", strokeWidth: 1.5, "aria-hidden": true }) : null;
}

// Keunggulan: dua kolom bernomor besar, teks outline dari eyebrow di belakang.
function FeaturesSection({ block }: { block: Extract<Block, { type: "FEATURES" }> }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="relative overflow-hidden border-t border-border py-20 md:py-32">
      <OutlineText parallax className="top-10 -left-6 md:top-16">
        {outlineLabel(block.eyebrow)}
      </OutlineText>
      <Container className="relative space-y-10 md:space-y-12">
        <HeadingOrHidden id={id} eyebrow={block.eyebrow} heading={block.heading} fallback={FALLBACK_HEADINGS.FEATURES} />
        <Reveal>
          <ul data-reveal-children="item" className="grid gap-x-12 md:grid-cols-2">
            {block.items.map((item, index) => (
              <li key={index} className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 border-t border-border py-7 md:grid-cols-[72px_minmax(0,1fr)]">
                <IndexNumber position={index + 1} className="text-[28px] md:text-[32px]" />
                <div>
                  <h3 className="flex items-center gap-2 text-[20px] leading-[1.3] font-medium text-fg-strong">
                    <FeatureIcon name={item.icon} />
                    {item.title}
                  </h3>
                  {item.description ? <p className="mt-2 max-w-[48ch] text-body text-fg-muted">{item.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}

// Daftar sebagai panel bergaris; dua daftar berurutan berdampingan. Chip = bidang unggulan (pola titik).
function ListPair({ lists, categoryHrefs }: { lists: ListBlock[]; categoryHrefs: Map<string, string> }) {
  return (
    <section className="border-t border-border py-20 md:py-32" aria-label={lists.map((list) => list.heading || FALLBACK_HEADINGS.LIST).join(" dan ")}>
      <Container className={cn("grid gap-6", lists.length === 2 && "lg:grid-cols-2")}>
        {lists.map((list) => (
          <ListPanel key={list.id} list={list} categoryHrefs={categoryHrefs} />
        ))}
      </Container>
    </section>
  );
}

function ListPanel({ list, categoryHrefs }: { list: ListBlock; categoryHrefs: Map<string, string> }) {
  const id = useId();
  return (
    <div className="relative overflow-hidden border border-border p-6 md:p-10">
      {list.style === "chips" ? <DotPattern /> : null}
      <div className="relative" aria-labelledby={id} role="group">
        {list.eyebrow ? <p className="mb-4 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{list.eyebrow}</p> : null}
        <h2 id={id} className={cn("mb-6 text-h3 text-fg-strong md:text-[28px]", !list.heading && "sr-only")}>
          {list.heading || FALLBACK_HEADINGS.LIST}
        </h2>
        {list.style === "chips" ? (
          <Reveal as="ul" data-reveal-children="pop" className="flex flex-wrap gap-2">
            {list.items.map((item, index) => {
              const href = categoryHrefs.get(item.trim().toLowerCase());
              const chip = "inline-flex h-8 items-center rounded-full border border-border-strong bg-bg px-3 text-small text-fg";
              return (
                <li key={index}>
                  {href ? (
                    <Link
                      href={href}
                      className={cn(chip, "outline-none transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2")}
                    >
                      {item}
                    </Link>
                  ) : (
                    <span className={chip}>{item}</span>
                  )}
                </li>
              );
            })}
          </Reveal>
        ) : (
          <Reveal>
            <ul data-reveal-children="item" className="border-b border-border">
              {list.items.map((item, index) => (
                <li key={index} className="flex gap-3 border-t border-border py-3.5 text-body text-fg">
                  <span aria-hidden className="pt-0.5 font-mono text-small text-fg-muted">
                    {pad(index + 1)}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </div>
  );
}

// Foto besar ber-Viewfinder; keterangan (CMS) sebagai label HUD di sudut.
function PhotoBlock({ block }: { block: Extract<Block, { type: "IMAGE" }> }) {
  return (
    <figure className="border-t border-border py-12 md:py-16">
      <Container>
        <Reveal>
          <RevealImage className="relative aspect-[4/3] overflow-hidden bg-bg-muted sm:aspect-video lg:aspect-auto lg:h-[560px]">
            <PublicImage image={block.image} sizes="(min-width: 1280px) 1232px, 100vw" />
            <Viewfinder className="inset-4 md:inset-6" topLeft={block.caption ? <HudLabel tone="photo">{block.caption}</HudLabel> : undefined} />
          </RevealImage>
        </Reveal>
        {block.caption ? <figcaption className="sr-only">{block.caption}</figcaption> : null}
      </Container>
    </figure>
  );
}

// Unduhan company profile: panel bergaris. Kolom foto di mockup tidak tampil (blok tanpa gambar).
function DownloadSection({ block }: { block: Extract<Block, { type: "DOWNLOAD" }> }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-t border-border py-20 md:py-32">
      <Container>
        <div className="flex flex-col justify-between gap-8 border border-border p-6 md:p-12">
          <HeadingOrHidden id={id} eyebrow={block.eyebrow} heading={block.heading} fallback={FALLBACK_HEADINGS.DOWNLOAD} />
          {block.description ? <p className="max-w-[65ch] text-body text-fg-muted">{block.description}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <a href={block.file.url} download className={buttonVariants({ variant: "primary", size: "lg" })} {...MAGNETIC}>
              <DownloadIcon aria-hidden strokeWidth={1.5} />
              <RollText>{block.label}</RollText>
            </a>
            <Link href="/profil/portofolio" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "gap-2")}>
              Lihat portofolio
              <ButtonArrow />
            </Link>
            <span className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">PDF / {formatBytes(block.file.size)}</span>
          </div>
        </div>
      </Container>
    </section>
  );
}

// Rekening pembayaran di halaman profil: section biasa, isi sama dengan halaman statis.
function PaymentSection({ block }: { block: Extract<Block, { type: "PAYMENT_ACCOUNTS" }> }) {
  const id = useId();
  return (
    <section id={block.id} aria-labelledby={id} className="border-t border-border py-20 md:py-32">
      <Container className="space-y-8">
        <HeadingOrHidden id={id} eyebrow={block.eyebrow} heading={block.heading} fallback={FALLBACK_HEADINGS.PAYMENT_ACCOUNTS} />
        {block.intro ? <p className="max-w-[65ch] text-body-lg text-fg-muted">{block.intro}</p> : null}
        <PaymentAccounts anchor={block.id} accounts={block.accounts} confirm={block.confirm} />
      </Container>
    </section>
  );
}
