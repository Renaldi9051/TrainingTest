import { DownloadIcon } from "lucide-react";
import { createElement } from "react";
import { Reveal } from "@/components/motion/reveal";
import { LineDraw, RevealImage } from "@/components/motion/reveal-parts";
import { PublicImage } from "@/components/public/public-image";
import { PublicSection } from "@/components/public/public-section";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { ServiceRows } from "@/components/public/service-rows";
import { VisionMission } from "@/components/public/vision-mission";
import { RollText } from "@/components/motion/roll-text";
import { buttonVariants, MAGNETIC } from "@/components/ui/button";
import type { PublicPageBlock } from "@/lib/api/types";
import { categoryIcon } from "@/lib/category-icons";
import { formatBytes } from "@/lib/format";
import { blockAnchor } from "@/lib/static-page-plan";

// Judul h2 tersembunyi untuk blok tanpa judul (label UI, bukan konten).
const FALLBACK_HEADINGS: Record<PublicPageBlock["type"], string> = {
  RICH_TEXT: "Informasi",
  VISION_MISSION: "Visi dan misi",
  FEATURES: "Keunggulan",
  LIST: "Daftar",
  SERVICES: "Layanan",
  IMAGE: "Gambar",
  DOWNLOAD: "Unduhan",
};

const BLOCK_IMAGE_SIZES = "(min-width: 1280px) 1232px, calc(100vw - 32px)";

// Ikon dari daftar statis (sama dengan kategori); createElement karena komponennya dipilih per data.
function FeatureIcon({ name }: { name: string | null }) {
  const icon = categoryIcon(name);
  return icon ? createElement(icon, { className: "size-6 text-fg-strong", strokeWidth: 1.5, "aria-hidden": true }) : null;
}

function Block({ block, anchor }: { block: PublicPageBlock; anchor: string }) {
  switch (block.type) {
    case "RICH_TEXT":
      return (
        <PublicSection bare id={anchor} eyebrow={block.eyebrow} heading={block.heading} fallbackHeading={FALLBACK_HEADINGS.RICH_TEXT}>
          <RichTextHtml html={block.bodyHtml} className="max-w-[65ch] text-body-lg text-fg" />
        </PublicSection>
      );
    case "VISION_MISSION":
      return (
        <PublicSection bare id={anchor} eyebrow={block.eyebrow} heading="" fallbackHeading={FALLBACK_HEADINGS.VISION_MISSION}>
          <VisionMission vision={block.vision} mission={block.mission} motto={block.motto} />
        </PublicSection>
      );
    case "FEATURES":
      return (
        <PublicSection bare id={anchor} eyebrow={block.eyebrow} heading={block.heading} fallbackHeading={FALLBACK_HEADINGS.FEATURES}>
          <Reveal>
            <LineDraw />
            <ul data-reveal-children="card" className="grid sm:grid-cols-2 lg:grid-cols-3">
              {block.items.map((item, index) => (
                <li key={index} className="space-y-3 border-b border-border py-8 sm:pr-6">
                  <FeatureIcon name={item.icon} />
                  <h3 className="text-[20px] leading-[1.25] font-medium text-fg-strong md:text-[24px]">{item.title}</h3>
                  {item.description ? <p className="max-w-[48ch] text-body text-fg-muted">{item.description}</p> : null}
                </li>
              ))}
            </ul>
          </Reveal>
        </PublicSection>
      );
    case "LIST":
      return (
        <PublicSection bare id={anchor} eyebrow={block.eyebrow} heading={block.heading} fallbackHeading={FALLBACK_HEADINGS.LIST}>
          {block.style === "chips" ? (
            <Reveal as="ul" data-reveal-children="pop" className="flex flex-wrap gap-2">
              {block.items.map((item, index) => (
                <li key={index} className="inline-flex h-8 items-center rounded-full border border-border-strong px-3 text-small text-fg">
                  {item}
                </li>
              ))}
            </Reveal>
          ) : (
            <Reveal>
              <LineDraw />
              <ul data-reveal-children="item" className="grid gap-x-6 sm:grid-cols-2">
                {block.items.map((item, index) => (
                  <li key={index} className="flex gap-3 border-b border-border py-4 text-body text-fg">
                    <span aria-hidden className="font-mono text-small text-fg-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          )}
        </PublicSection>
      );
    case "SERVICES":
      return block.items.length > 0 ? (
        <PublicSection bare id={anchor} eyebrow={block.eyebrow} heading={block.heading} fallbackHeading={FALLBACK_HEADINGS.SERVICES} intro={block.intro}>
          <ServiceRows services={block.items} />
        </PublicSection>
      ) : null;
    case "IMAGE":
      return (
        <figure id={anchor} className="scroll-mt-28 space-y-3 py-10 first:pt-0 md:py-12">
          <Reveal>
            <RevealImage className="relative aspect-video overflow-hidden bg-bg-muted">
              <PublicImage image={block.image} sizes={BLOCK_IMAGE_SIZES} />
            </RevealImage>
          </Reveal>
          {block.caption ? <figcaption className="text-small text-fg-muted">{block.caption}</figcaption> : null}
        </figure>
      );
    case "DOWNLOAD":
      return (
        <PublicSection bare id={anchor} eyebrow={block.eyebrow} heading={block.heading} fallbackHeading={FALLBACK_HEADINGS.DOWNLOAD} intro={block.description}>
          <a href={block.file.url} download className={buttonVariants({ variant: "primary", size: "lg" })} {...MAGNETIC}>
            <DownloadIcon aria-hidden strokeWidth={1.5} />
            <RollText>{block.label}</RollText>
            <span className="font-mono text-label text-inverse-fg/70">PDF · {formatBytes(block.file.size)}</span>
          </a>
        </PublicSection>
      );
  }
}

// Blok halaman statis berurutan di kolom isi (di samping daftar isi). Pemisah antar blok: garis tipis
// (bukan kartu berlatar). Tiap blok punya anchor untuk daftar isi (lib/static-page-plan.ts).
export function PageBlocks({ blocks }: { blocks: PublicPageBlock[] }) {
  return (
    <div className="divide-y divide-border">
      {blocks.map((block, index) => (
        <Block key={block.id} block={block} anchor={blockAnchor(index)} />
      ))}
    </div>
  );
}
