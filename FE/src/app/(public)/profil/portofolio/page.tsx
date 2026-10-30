import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Viewfinder } from "@/components/decor/viewfinder";
import { ActiveIndicator } from "@/components/motion/active-indicator";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RevealRows } from "@/components/motion/reveal-rows";
import { ChipLink } from "@/components/public/chip-link";
import { PageHero } from "@/components/public/page-hero";
import { PortfolioGallery } from "@/components/public/portfolio-gallery";
import { PublicImage } from "@/components/public/public-image";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getPortfolio, getSettings } from "@/lib/api/public";
import type { PublicPortfolioItem } from "@/lib/api/types";
import { dateBadgeParts } from "@/lib/format";
import { ACTIVITY_TYPE_LABELS } from "@/lib/labels";
import {
  activityHref,
  availableActivityTypes,
  cardSpan,
  filterPortfolio,
  parseActivityParam,
  type CardSpan,
} from "@/lib/portfolio-plan";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Portofolio",
  alternates: { canonical: "/profil/portofolio" },
};

const SPAN_CLASS: Record<CardSpan, string> = {
  4: "md:col-span-6 lg:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
};

// Label UI bawaan; diganti isi Pengaturan > Kepala halaman kalau diisi.
const DEFAULT_TITLE = "Portofolio";

export default async function PortfolioPage({ searchParams }: PageProps<"/profil/portofolio">) {
  const settings = await getSettings();
  const header = settings.pageHeaders.portofolio;

  return (
    <>
      <PageHero
        crumbs={[{ label: "Profil", href: "/profil" }, { label: header.heading || DEFAULT_TITLE }]}
        eyebrow={header.eyebrow || undefined}
        title={header.heading || DEFAULT_TITLE}
        lead={header.lead || null}
        outline="Portofolio"
      />
      <Container className="pt-10 pb-20 md:pb-28">
        {/* Filter ?jenis= dibaca saat request: daftar di-stream di dalam Suspense, kepala halaman statis. */}
        <Suspense fallback={<GallerySkeleton />}>
          <PortfolioList searchParams={searchParams} />
        </Suspense>
      </Container>

      <section aria-labelledby="portofolio-cta" className="border-t border-border py-20 md:py-24">
        <Container className="flex flex-wrap items-center justify-between gap-6">
          <h2 id="portofolio-cta" className="max-w-[20ch] text-h2 text-fg-strong">
            Ingin kegiatan Anda masuk daftar ini?
          </h2>
          <Link href="/kontak" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "gap-2")}>
            Hubungi kami
            <ButtonArrow />
          </Link>
        </Container>
      </section>
    </>
  );
}

async function PortfolioList({ searchParams }: { searchParams: PageProps<"/profil/portofolio">["searchParams"] }) {
  const [items, query] = await Promise.all([getPortfolio(), searchParams]);
  const types = availableActivityTypes(items);
  const active = parseActivityParam(query.jenis);
  // Jenis yang tidak punya item (atau tidak dikenal) diperlakukan sebagai "Semua".
  const selected = active && types.includes(active) ? active : null;
  const shown = filterPortfolio(items, selected);
  if (items.length === 0) {
    return <p className="border-t border-border pt-8 text-body text-fg-muted">Dokumentasi kegiatan sedang disiapkan.</p>;
  }
  return (
    <>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        {types.length > 0 ? (
          <div role="group" aria-label="Filter jenis kegiatan">
            <ActiveIndicator variant="pill" className="flex flex-wrap gap-2">
              <ChipLink href={activityHref(null)} active={!selected}>
                Semua
              </ChipLink>
              {types.map((type) => (
                <ChipLink key={type} href={activityHref(type)} active={selected === type}>
                  {ACTIVITY_TYPE_LABELS[type]}
                </ChipLink>
              ))}
            </ActiveIndicator>
          </div>
        ) : null}
        <p role="status" className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
          {shown.length} kegiatan
        </p>
      </div>
      <RevealRows as="ul" kind="card" className="grid gap-x-6 gap-y-12 md:grid-cols-12">
        {shown.map((item, index) => (
          <li key={`${item.title}-${index}`} className={cn("min-w-0", SPAN_CLASS[cardSpan(index, Boolean(selected))])}>
            {/* Kartu pertama biasanya di layar awal (LCP): fotonya dimuat lebih dulu. */}
            <PortfolioCard item={item} wide={cardSpan(index, Boolean(selected)) === 7} priority={index === 0} />
          </li>
        ))}
      </RevealRows>
    </>
  );
}

function GallerySkeleton() {
  return (
    <div role="status" aria-label="Memuat portofolio" className="grid gap-6 md:grid-cols-12">
      <div className="aspect-[16/10] bg-bg-muted md:col-span-7" />
      <div className="aspect-[4/3] bg-bg-muted md:col-span-5" />
    </div>
  );
}

const CARD_SIZES = "(min-width: 1024px) 720px, (min-width: 768px) 50vw, 100vw";

// Kartu kegiatan: foto pertama (berwarna, hover zoom + sudut Viewfinder), jumlah foto, jenis,
// bulan, judul (membuka galeri lengkap), klien. Tanpa foto: tanpa blok gambar.
function PortfolioCard({ item, wide, priority }: { item: PublicPortfolioItem; wide: boolean; priority: boolean }) {
  const [cover] = item.images;
  const date = item.date ? dateBadgeParts(item.date).monthYear : null;
  const typeLabel = item.activityType ? ACTIVITY_TYPE_LABELS[item.activityType] : null;
  const meta = [typeLabel, date].filter((value): value is string => Boolean(value));
  return (
    <article className="group relative">
      {cover ? (
        <RevealImage className={cn("relative overflow-hidden bg-bg-muted", wide ? "aspect-[16/10]" : "aspect-[4/3]")}>
          <PublicImage
            image={cover}
            sizes={CARD_SIZES}
            priority={priority}
            className="transition-transform duration-300 ease-standard motion-safe:group-hover:scale-[1.03]"
            film
          />
          <Viewfinder size="sm" hover />
          <span className="absolute bottom-3.5 left-4 bg-fg-strong/60 px-2 py-1 font-mono text-label uppercase tracking-[0.08em] text-inverse-fg">
            {item.images.length} foto
          </span>
        </RevealImage>
      ) : null}
      {meta.length > 0 ? (
        <div className="mt-4 flex justify-between gap-4 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
          <span>{typeLabel}</span>
          <span>{date}</span>
        </div>
      ) : null}
      <h2 className="mt-2 text-h3 text-fg-strong">
        <PortfolioGallery title={item.title} meta={meta} description={item.description} images={item.images} />
      </h2>
      {item.client ? <p className="mt-1.5 text-small text-fg-muted">{item.client}</p> : null}
    </article>
  );
}
