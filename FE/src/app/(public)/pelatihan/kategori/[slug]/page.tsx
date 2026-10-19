import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { HudLabel } from "@/components/decor/hud-label";
import { Viewfinder } from "@/components/decor/viewfinder";
import { ActiveIndicator } from "@/components/motion/active-indicator";
import { ChipLink } from "@/components/public/chip-link";
import { PageHero } from "@/components/public/page-hero";
import { PublicImage } from "@/components/public/public-image";
import { Pagination } from "@/components/public/pagination";
import { ScheduleTable } from "@/components/public/schedule-table";
import { TrainingGrid } from "@/components/public/training-card";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCatalog, getCategories, getCategory, getSchedules } from "@/lib/api/public";
import type { PublicCategory } from "@/lib/api/types";
import { METHOD_PARAMS } from "@/lib/catalog-url";
import { formatNumber, monthParam } from "@/lib/format";
import { cn } from "@/lib/utils";

// Paginasi (?hal) dan filter metode (?metode) dibaca dari query string, sehingga rute dirender
// sesuai permintaan. Slug yang tidak ada = notFound() (HTTP 404).
export const instant = false;
// 12 per halaman: pas untuk grid 3 kolom (sebelumnya 10, menyisakan satu kartu di baris terakhir).
const LANDING_SIZE = 12;
// Chip "kategori lain" di bawah judul.
const OTHER_CATEGORIES = 7;
const UPCOMING_ON_LANDING = 3;

type MethodParam = (typeof METHOD_PARAMS)[number];
const METHOD_TEXT: Record<MethodParam, string> = { online: "Online", offline: "Offline", hybrid: "Hybrid" };

function parsePage(value: string | string[] | undefined): number {
  const raw = Number.parseInt((Array.isArray(value) ? value[0] : value) ?? "1", 10);
  return Number.isFinite(raw) && raw > 1 ? Math.min(raw, 1000) : 1;
}

function parseMethod(value: string | string[] | undefined): MethodParam | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return METHOD_PARAMS.find((method) => method === raw);
}

function landingHref(slug: string, change: { metode?: MethodParam; hal?: number }): string {
  const params = new URLSearchParams();
  if (change.metode) params.set("metode", change.metode);
  if (change.hal && change.hal > 1) params.set("hal", String(change.hal));
  const query = params.toString();
  return `/pelatihan/kategori/${slug}${query ? `?${query}` : ""}`;
}

export async function generateMetadata({ params }: PageProps<"/pelatihan/kategori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Kategori tidak ditemukan" };
  return {
    title: `Pelatihan ${category.name}`,
    description: category.description ?? undefined,
    alternates: { canonical: `/pelatihan/kategori/${category.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/pelatihan/kategori/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(query.hal);
  const metode = parseMethod(query.metode);
  const category = await getCategory(slug);
  if (!category) notFound();
  // "Jadwal bulan ini" bergantung pada tanggal hari ini: dihitung per request.
  await connection();
  const [catalog, categories, upcoming, thisMonth] = await Promise.all([
    getCatalog({ kategori: [category.slug], metode, hal: page, per: LANDING_SIZE }),
    getCategories(),
    getSchedules({ kategori: category.slug }),
    getSchedules({ kategori: category.slug, bulan: monthParam(new Date()) }),
  ]);
  const listed = categories.filter((item) => item.trainingCount > 0 || item.slug === category.slug);
  const position = listed.findIndex((item) => item.slug === category.slug);
  const pad = (value: number) => String(value).padStart(2, "0");
  const catalogFiltered = `/pelatihan?kategori=${category.slug}`;
  const sessions = upcoming.items.slice(0, UPCOMING_ON_LANDING);

  return (
    <>
      <PageHero
        crumbs={[{ label: "Pelatihan", href: "/pelatihan" }, { label: category.name }]}
        eyebrow={position >= 0 ? `Kategori ${pad(position + 1)} / ${pad(listed.length)}` : "Kategori"}
        title={category.name}
        outline={category.name}
        aside={
          <div>
            {category.description ? (
              <p data-page-enter="" className="max-w-[65ch] text-body-lg text-fg-muted">
                {category.description}
              </p>
            ) : null}
            <dl className={cn("flex gap-8", category.description && "mt-6")}>
              <Stat value={formatNumber(category.trainingCount)} label="Judul / aktif" />
              <Stat value={pad(thisMonth.meta.total)} label="Jadwal / bulan ini" />
            </dl>
          </div>
        }
      />

      {/* Gambar kategori (diisi admin): foto lebar berwarna seperti foto di detail pelatihan.
          Kosong: tanpa blok gambar (aturan konten 6, bukan placeholder). */}
      {category.image ? (
        <Container className="pt-8">
          <div data-category-image="" className="relative aspect-4/3 overflow-hidden bg-bg-muted sm:aspect-video lg:aspect-auto lg:h-130">
            <PublicImage image={category.image} sizes="(min-width: 1280px) 1232px, 100vw" priority />
            <Viewfinder className="inset-4 md:inset-6" topLeft={<HudLabel tone="photo">{`Kategori / ${category.name}`}</HudLabel>} />
          </div>
        </Container>
      ) : null}

      <Container className="pt-8 pb-20 md:pb-24">
        {/* Di luar kepala halaman supaya tidak menumpuk di atas teks outline (DESIGN.md 6.2). */}
        <OtherCategories current={category} categories={listed} />
        <div className="mb-8 flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong">
            {formatNumber(catalog.meta.total)} pelatihan
          </p>
          <div role="group" aria-label="Metode">
            <ActiveIndicator variant="pill" className="flex flex-wrap gap-2">
              <ChipLink href={landingHref(category.slug, {})} active={!metode}>
                Semua
              </ChipLink>
              {METHOD_PARAMS.map((method) => (
                <ChipLink key={method} href={landingHref(category.slug, { metode: method })} active={metode === method}>
                  {METHOD_TEXT[method]}
                </ChipLink>
              ))}
            </ActiveIndicator>
          </div>
        </div>

        {catalog.items.length > 0 ? (
          <TrainingGrid trainings={catalog.items} headingLevel="h2" label="level" />
        ) : (
          <div className="border border-dashed border-border-strong px-6 py-16 text-center">
            <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">0 hasil</p>
            <p className="mt-3 text-h3 text-fg-strong">
              {metode ? "Belum ada pelatihan dengan metode ini." : "Belum ada pelatihan di kategori ini."}
            </p>
            <Link href={metode ? landingHref(category.slug, {}) : "/pelatihan"} className={cn(buttonVariants({ variant: "secondary" }), "mt-6")}>
              {metode ? "Tampilkan semua metode" : "Lihat katalog"}
            </Link>
          </div>
        )}

        <div className="mt-16">
          <Pagination meta={catalog.meta} hrefFor={(number) => landingHref(category.slug, { metode, hal: number })} />
        </div>
        <div className="mt-10 flex justify-center">
          <Link href={metode ? `${catalogFiltered}&metode=${metode}` : catalogFiltered} className={cn(buttonVariants({ variant: "ghost" }), "gap-2")}>
            Cari dan saring di katalog
            <ButtonArrow />
          </Link>
        </div>
      </Container>

      {sessions.length > 0 ? (
        <section aria-labelledby="sesi-kategori-title" className="bg-bg-subtle py-20 md:py-24">
          <Container>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow>Jadwal kategori ini</Eyebrow>
                <h2 id="sesi-kategori-title" className="mt-3 text-h2 text-fg-strong">
                  Sesi terdekat
                </h2>
              </div>
              <Link href={`/jadwal?kategori=${category.slug}`} className={cn(buttonVariants({ variant: "ghost" }), "gap-2")}>
                Lihat semua jadwal
                <ButtonArrow />
              </Link>
            </div>
            <ScheduleTable rows={sessions} caption={`Sesi terdekat ${category.name}`} showTraining bigDate />
          </Container>
        </section>
      ) : null}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    // dt lebih dulu di DOM (urutan dl yang benar), angka tampil di atas.
    <div className="flex flex-col-reverse">
      <dt className="mt-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{label}</dt>
      <dd className="font-mono text-[32px] leading-none font-medium tracking-[-0.03em] text-primary">{value}</dd>
    </div>
  );
}

// Chip kategori lain (gulir horizontal), kategori ini aktif di depan, diakhiri "Semua kategori".
function OtherCategories({ current, categories }: { current: PublicCategory; categories: PublicCategory[] }) {
  const others = categories
    .filter((item) => item.slug !== current.slug)
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, OTHER_CATEGORIES);
  if (others.length === 0) return null;
  return (
    <nav aria-label="Kategori lain" className="-mx-4 mb-10 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2">
        <li>
          <Link
            href={`/pelatihan/kategori/${current.slug}`}
            aria-current="page"
            className="inline-flex h-8 items-center rounded-full border border-primary bg-primary px-3 text-small whitespace-nowrap text-on-primary outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            {current.name}
          </Link>
        </li>
        {others.map((item) => (
          <li key={item.slug}>
            <ChipLink href={`/pelatihan/kategori/${item.slug}`} active={false} scroll>
              {item.name}
            </ChipLink>
          </li>
        ))}
        <li>
          <ChipLink href="/pelatihan" active={false} scroll>
            Semua kategori <span aria-hidden className="ml-1">→</span>
          </ChipLink>
        </li>
      </ul>
    </nav>
  );
}
