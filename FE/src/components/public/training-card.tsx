import Link from "next/link";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RevealRows } from "@/components/motion/reveal-rows";
import type { PublicTrainingCard } from "@/lib/api/types";
import { Viewfinder } from "@/components/decor/viewfinder";
import { displayTitle, isUntitled } from "@/lib/display-title";
import { LEVEL_LABELS, METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PublicImage } from "./public-image";

export const CARD_IMAGE_SIZES = "(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw";

// Kartu pelatihan DESIGN 8.4 (palet D v0.4): kotak radius 12 px ber-border, gambar 4:3 -> label mono
// --secondary -> judul h3 -> meta, teks berjarak 18 px dari tepi. Gambar memakai grading film
// (--photo-filter) yang lepas saat hover/fokus (transisi filter 300 ms, pengecualian DESIGN 9.3 v0.4;
// menggantikan gambar hitam putih keputusan 28 Okt 2026).
// Hover: border --primary + kartu naik 3 px, gambar zoom 1.03, sudut Viewfinder 12 px masuk, judul bergaris bawah,
// label "Lihat →" mengikuti kursor (PointerEffects, hanya desktop). Di grid: gambar wipe dari bawah
// + zoom 1,15 -> 1 bersama kartunya.
// Gambar: sampul pelatihan, atau gambar kategori kalau sampul kosong (coverSource dari BE).
// Tanpa keduanya: blok 4:3 --bg-muted berisi label kategori dan sudut Viewfinder tipis (elemen UI,
// bukan foto pengganti), supaya grid tetap rata; hover-nya sama (sudut masuk, judul bergaris bawah).
// label: "category" (katalog, beranda) atau "level" (landing kategori; kembali ke kategori kalau
// tingkat belum diisi).
export function TrainingCard({
  training,
  headingLevel = "h3",
  label = "category",
}: {
  training: PublicTrainingCard;
  headingLevel?: "h2" | "h3";
  label?: "category" | "level";
}) {
  const Heading = headingLevel;
  const categoryText = training.categories.map((category) => category.name).join(" · ");
  const labelText = label === "level" && training.level ? LEVEL_LABELS[training.level] : categoryText;
  const meta = [
    training.duration,
    training.method ? METHOD_LABELS[training.method] : null,
    training.types.length > 0 ? training.types.map((type) => TYPE_LABELS[type]).join(" / ") : null,
  ].filter(Boolean);

  return (
    <article
      data-cursor-label=""
      data-cover-source={training.coverSource ?? "none"}
      className={cn(
        "group relative flex h-full flex-col rounded-card border border-border bg-bg pb-[18px]",
        // Border 150 ms (DESIGN 9.3, pengecualian v0.3), naik 3 px 300 ms.
        "transition-[border-color,translate] ease-standard [transition-duration:150ms,300ms]",
        "hover:border-primary focus-within:border-primary motion-safe:hover:-translate-y-[3px]",
      )}
    >
      <RevealImage className="relative aspect-[4/3] overflow-hidden rounded-t-[calc(var(--card-radius,var(--radius))-1px)] bg-bg-muted">
        {training.cover ? (
          <>
            <PublicImage
              image={training.cover}
              sizes={CARD_IMAGE_SIZES}
              film
              className="transition-[transform,filter] duration-300 ease-standard group-hover:scale-[1.03] group-hover:filter-none group-focus-within:filter-none motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
            <Viewfinder size="sm" tone="plain" hover />
          </>
        ) : (
          <>
            {/* Sudut selalu tampil (sedikit di luar posisi), bergeser masuk saat hover/fokus. */}
            <Viewfinder size="sm" tone="mark" hover className="opacity-100" />
            {training.categories[0] ? (
              <p
                aria-hidden
                className="absolute right-6 bottom-6 left-6 line-clamp-2 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted"
              >
                {training.categories[0].name}
              </p>
            ) : null}
          </>
        )}
      </RevealImage>
      {labelText ? (
        <p className="mt-5 px-[18px] font-mono text-label uppercase tracking-[0.08em] text-secondary">{labelText}</p>
      ) : null}
      <Heading className={cn("mt-2 px-[18px] text-h3", isUntitled(training.title) ? "text-fg-muted" : "text-fg-strong")}>
        {/* Seluruh kartu bisa diklik lewat pseudo-element, tapi tetap satu link untuk pembaca layar. */}
        <Link
          href={`/pelatihan/${training.slug}`}
          className="underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 focus-visible:underline after:rounded-card focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-4"
        >
          {displayTitle(training.title)}
        </Link>
      </Heading>
      {meta.length > 0 ? <p className="mt-3 px-[18px] text-small text-fg-muted">{meta.join(" · ")}</p> : null}
    </article>
  );
}

// headingLevel: h2 kalau grid langsung di bawah h1 halaman (katalog, landing kategori), h3 kalau
// di bawah judul section (pelatihan terkait), supaya urutan heading tidak melompat.
// columns: 3 = grid penuh; "narrow" = grid di samping sidebar filter (2 kolom sampai xl).
// Masuk: kartu naik per baris visual saat barisnya masuk viewport (stagger 80 ms, kolom kanan +60 ms).
export function TrainingGrid({
  trainings,
  headingLevel = "h3",
  label = "category",
  narrow = false,
}: {
  trainings: PublicTrainingCard[];
  headingLevel?: "h2" | "h3";
  label?: "category" | "level";
  narrow?: boolean;
}) {
  return (
    <RevealRows
      as="ul"
      kind="card"
      className={cn("grid gap-x-6 gap-y-10 sm:grid-cols-2", narrow ? "xl:grid-cols-3" : "lg:grid-cols-3")}
    >
      {trainings.map((training) => (
        <li key={training.slug}>
          <TrainingCard training={training} headingLevel={headingLevel} label={label} />
        </li>
      ))}
    </RevealRows>
  );
}

export function TrainingGridSkeleton({ count = 6, narrow = false }: { count?: number; narrow?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Memuat pelatihan"
      className={cn("grid gap-x-6 gap-y-10 sm:grid-cols-2", narrow ? "xl:grid-cols-3" : "lg:grid-cols-3")}
    >
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
