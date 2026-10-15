import Link from "next/link";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RevealRows } from "@/components/motion/reveal-rows";
import type { PublicTrainingCard } from "@/lib/api/types";
import { METHOD_LABELS } from "@/lib/labels";
import { PublicImage } from "./public-image";

export const CARD_IMAGE_SIZES = "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw";

function ReferenceTrainingCard({ training, headingLevel, categoryStyle = false }: { training: PublicTrainingCard; headingLevel: "h2" | "h3"; categoryStyle?: boolean }) {
  const Heading = headingLevel;
  const category = training.categories[0]?.name ?? "Pelatihan";
  const date = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(training.publishedAt));
  return (
    <article className={`group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgb(0_0_0_/_0.12)] ${categoryStyle ? "min-h-[460px]" : "min-h-[510px]"}`}>
      <div className="relative aspect-[1.55] overflow-hidden bg-[#15477c]">
        {training.cover ? (
          <PublicImage image={training.cover} sizes={CARD_IMAGE_SIZES} grayscale={false} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="absolute inset-0 flex items-center bg-[linear-gradient(135deg,#1e598f,#092e5b)] p-7 text-white">
            <span className="max-w-[24ch] text-[22px] leading-tight font-bold uppercase drop-shadow-sm">{training.title}</span>
          </div>
        )}
        <span className={`absolute top-5 max-w-[70%] truncate rounded-full px-4 py-1 text-[11px] font-semibold uppercase ${categoryStyle ? "left-5 bg-white text-[#0b417f]" : "right-5 bg-[#c92b1d] text-white"}`}>
          {category}
        </span>
      </div>
      <div className={`flex flex-1 flex-col ${categoryStyle ? "px-5 pt-7 pb-4" : "px-7 pt-8 pb-7"}`}>
        <Heading className={`text-[20px] leading-[1.35] font-bold uppercase ${categoryStyle ? "text-[#0b417f]" : "text-[#111]"}`}>
          <Link href={`/pelatihan/${training.slug}`} className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-[#0c4383] focus-visible:after:ring-inset">
            {training.title}
          </Link>
        </Heading>
        {training.summary ? <p className={`line-clamp-4 text-[14px] leading-[1.5] ${categoryStyle ? "mt-1 text-[#111]" : "mt-6 text-[#858585]"}`}>{training.summary}</p> : null}
        {categoryStyle ? <span className="mt-4 text-[12px] font-semibold text-[#c92b1d] uppercase">Selengkapnya »</span> : null}
      </div>
      <div className={`border-t border-[#e9e9e9] py-3 text-[12px] ${categoryStyle ? "px-5 text-[#c92b1d]" : "px-7 text-[#aaa]"}`}>{date} &nbsp;·&nbsp; No Comments</div>
    </article>
  );
}

// Kartu pelatihan DESIGN 7: gambar 4:3 grayscale -> label kategori mono -> judul h3 -> meta -> garis.
// Hover: gambar zoom 1.03 dan kembali berwarna, judul bergaris bawah, label "Lihat →" mengikuti kursor
// (PointerEffects, hanya desktop). Di grid: gambar wipe dari bawah + zoom 1,15 -> 1 bersama kartunya.
export function TrainingCard({ training, headingLevel = "h3", variant = "default" }: { training: PublicTrainingCard; headingLevel?: "h2" | "h3"; variant?: "default" | "reference" | "reference-category" }) {
  if (variant !== "default") return <ReferenceTrainingCard training={training} headingLevel={headingLevel} categoryStyle={variant === "reference-category"} />;
  const Heading = headingLevel;
  const meta = [training.duration, training.method ? METHOD_LABELS[training.method] : null].filter(Boolean);

  return (
    <article data-cursor-label="" className="group relative flex h-full flex-col border-b border-border pb-6">
      <RevealImage className="relative aspect-[4/3] overflow-hidden bg-bg-muted">
        {training.cover ? (
          <PublicImage
            image={training.cover}
            sizes={CARD_IMAGE_SIZES}
            className="transition-[transform,filter] duration-300 ease-standard group-hover:scale-[1.03] group-hover:grayscale-0 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
      </RevealImage>
      {training.categories[0] ? (
        <p className="mt-5 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
          {training.categories.map((category) => category.name).join(" · ")}
        </p>
      ) : null}
      <Heading className="mt-2 text-[20px] leading-[1.25] font-medium text-fg-strong md:text-[24px]">
        {/* Seluruh kartu bisa diklik lewat pseudo-element, tapi tetap satu link untuk pembaca layar. */}
        <Link
          href={`/pelatihan/${training.slug}`}
          className="underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 focus-visible:underline focus-visible:after:ring-2 focus-visible:after:ring-fg-strong focus-visible:after:ring-offset-4"
        >
          {training.title}
        </Link>
      </Heading>
      {meta.length > 0 ? <p className="mt-3 text-small text-fg-muted">{meta.join(" · ")}</p> : null}
    </article>
  );
}

// headingLevel: h2 kalau grid langsung di bawah h1 halaman (katalog, landing kategori), h3 kalau
// di bawah judul section (pelatihan terkait), supaya urutan heading tidak melompat.
// Masuk: kartu naik per baris visual saat barisnya masuk viewport (stagger 80 ms, kolom kanan +60 ms).
export function TrainingGrid({
  trainings,
  headingLevel = "h3",
  variant = "default",
}: {
  trainings: PublicTrainingCard[];
  headingLevel?: "h2" | "h3";
  variant?: "default" | "reference" | "reference-category";
}) {
  return (
    <RevealRows as="ul" kind="card" className={variant !== "default" ? "grid gap-7 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3"}>
      {trainings.map((training) => (
        <li key={training.slug}>
          <TrainingCard training={training} headingLevel={headingLevel} variant={variant} />
        </li>
      ))}
    </RevealRows>
  );
}

export function TrainingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Memuat pelatihan" className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="space-y-4 border-b border-border pb-6">
          <div className="aspect-[4/3] bg-bg-muted" />
          <div className="h-3 w-24 bg-bg-muted" />
          <div className="h-6 w-4/5 bg-bg-muted" />
          <div className="h-4 w-1/3 bg-bg-muted" />
        </div>
      ))}
      <span className="sr-only">Memuat pelatihan...</span>
    </div>
  );
}
