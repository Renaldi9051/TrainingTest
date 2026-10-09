import Link from "next/link";
import type { PublicTrainingCard } from "@/lib/api/types";
import { METHOD_LABELS } from "@/lib/labels";
import { PublicImage } from "./public-image";

export const CARD_IMAGE_SIZES = "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw";

// Kartu pelatihan DESIGN 7: gambar 4:3 grayscale -> label kategori mono -> judul h3 -> meta -> garis.
// Hover: gambar zoom 1.03 dan kembali berwarna, judul bergaris bawah.
export function TrainingCard({ training, headingLevel = "h3" }: { training: PublicTrainingCard; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const meta = [training.duration, training.method ? METHOD_LABELS[training.method] : null].filter(Boolean);

  return (
    <article className="group relative flex h-full flex-col border-b border-border pb-6">
      <div className="relative aspect-[4/3] overflow-hidden bg-bg-muted">
        {training.cover ? (
          <PublicImage
            image={training.cover}
            sizes={CARD_IMAGE_SIZES}
            className="transition-[transform,filter] duration-300 ease-standard group-hover:scale-[1.03] group-hover:grayscale-0 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
      </div>
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

export function TrainingGrid({ trainings }: { trainings: PublicTrainingCard[] }) {
  return (
    <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {trainings.map((training) => (
        <li key={training.slug}>
          <TrainingCard training={training} />
        </li>
      ))}
    </ul>
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
