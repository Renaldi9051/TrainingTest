import { UserIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GrainOverlay } from "@/components/decor/grain-overlay";
import { HudLabel } from "@/components/decor/hud-label";
import { OutlineText } from "@/components/decor/outline-text";
import { RotatingBadge } from "@/components/decor/rotating-badge";
import { Viewfinder } from "@/components/decor/viewfinder";
import { ScrollSpyToc } from "@/components/motion/scroll-spy-toc";
import { CategoryTrainingList } from "@/components/public/category-training-list";
import { ContactPanelTrigger, contactsWithWhatsapp } from "@/components/public/floating-contact";
import { Breadcrumb } from "@/components/public/page-hero";
import { PublicImage } from "@/components/public/public-image";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getCategory, getMarketing, getRedirect, Tag } from "@/lib/api/public";
import { formatNumber } from "@/lib/format";
import { followRedirect } from "@/lib/public-redirect";
import { cn } from "@/lib/utils";

// Halaman landing kategori v2: hero + cover, tab anchor, Tentang, Daftar pelatihan (judul saja),
// Target peserta (galeri dihapus, permintaan pemilik 11 Nov 2026). Slug tidak ada = redirect (slug diganti/kategori digabung) atau 404.
// Rute blocking (bukan prerender penuh): getRedirect/getMarketing diakses per request; data kategori
// tetap di-cache lewat tag.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/pelatihan/kategori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Kategori tidak ditemukan" };
  const description = category.metaDescription || undefined;
  return {
    title: `Pelatihan ${category.name}`,
    description,
    alternates: { canonical: `/pelatihan/kategori/${category.slug}` },
    openGraph: category.image ? { images: [{ url: category.image.url }] } : undefined,
  };
}

export default async function CategoryPage({ params }: PageProps<"/pelatihan/kategori/[slug]">) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) {
    const target = await getRedirect(`/pelatihan/kategori/${slug}`, Tag.category(slug));
    if (target) followRedirect(target);
    notFound();
  }
  const marketing = await getMarketing();
  const hasMarketing = contactsWithWhatsapp(marketing).length > 0;

  const coverAlt = category.coverAlt ?? category.image?.alt ?? `Dokumentasi kategori ${category.name}`;

  // Section yang datanya kosong disembunyikan beserta tab-nya.
  const hasAbout = category.descriptionParagraphs.length > 0;
  const hasAudience = category.audience.length > 0;
  const tabs = [
    hasAbout ? { id: "tentang", label: "Tentang" } : null,
    { id: "daftar", label: `Daftar pelatihan (${category.trainings.length})` },
    hasAudience ? { id: "peserta", label: "Target peserta" } : null,
  ].filter((tab): tab is { id: string; label: string } => tab !== null);

  // JSON-LD ItemList berisi Course untuk tiap pelatihan.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Pelatihan ${category.name}`,
    numberOfItems: category.trainings.length,
    itemListElement: category.trainings.map((training, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: { "@type": "Course", name: training.title, url: `/pelatihan/${training.slug}` },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      {/* Hero split: kiri teks + CTA, kanan cover. Cover kosong = judul selebar container. */}
      <section className="relative overflow-hidden border-b border-border bg-bg-subtle pt-12 pb-12 md:pt-18 md:pb-16">
        <OutlineText className="right-4 bottom-[0.16em] sm:right-6">{category.name}</OutlineText>
        <Container className="relative z-[1]">
          <Breadcrumb crumbs={[{ label: "Pelatihan", href: "/pelatihan" }, { label: category.name }]} />
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
            <div className={cn(category.image ? "lg:col-span-6" : "lg:col-span-9")}>
              <Eyebrow className="mb-4">{`Kategori / ${formatNumber(category.trainingCount)} pelatihan`}</Eyebrow>
              <h1 className="max-w-[16ch] text-h1 text-fg-strong">{category.name}</h1>
              {category.summary ? (
                <p className="mt-4 max-w-[60ch] text-body-lg text-fg-muted">{category.summary}</p>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="#daftar" className={buttonVariants({ variant: "primary", size: "lg" })}>
                  Lihat daftar pelatihan <span aria-hidden className="ml-2">→</span>
                </Link>
                {hasMarketing ? (
                  <ContactPanelTrigger className={buttonVariants({ variant: "secondary", size: "lg" })}>
                    Konsultasi
                  </ContactPanelTrigger>
                ) : (
                  <Link href="/kontak" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                    Konsultasi
                  </Link>
                )}
              </div>
            </div>
            {category.image ? (
              <div className="lg:col-span-6">
                <div data-category-cover="" className="relative aspect-video overflow-hidden rounded-card bg-bg-muted">
                  <PublicImage
                    film
                    priority
                    image={{ ...category.image, alt: coverAlt }}
                    sizes="(min-width: 1024px) 600px, 100vw"
                  />
                  <Viewfinder className="inset-4 md:inset-6" topLeft={<HudLabel tone="photo">{`Kategori / ${category.name}`}</HudLabel>} />
                </div>
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {/* Tab anchor sticky di bawah header. */}
      <nav aria-label="Isi kategori" className="sticky top-18 z-30 border-b border-border bg-bg/90 backdrop-blur">
        <Container>
          <ScrollSpyToc orientation="horizontal" sections={tabs} />
        </Container>
      </nav>

      {hasAbout ? (
        <section id="tentang" aria-labelledby="tentang-title" className="scroll-mt-32 border-b border-border py-16 md:py-20">
          <Container>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
              <div className="md:col-span-4">
                <Eyebrow>01 / Tentang kategori</Eyebrow>
                <h2 id="tentang-title" className="mt-3 text-h2 text-fg-strong">
                  Tentang {category.name}
                </h2>
              </div>
              <div data-category-description="" className="space-y-5 md:col-span-7 md:col-start-6">
                {category.descriptionParagraphs.map((paragraph, index) => (
                  <p key={index} className="max-w-[65ch] text-body-lg text-fg-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </Container>
        </section>
      ) : null}

      <section id="daftar" aria-labelledby="daftar-title" className="scroll-mt-32 border-b border-border py-16 md:py-20">
        <Container>
          <Eyebrow className="mb-3">02 / Daftar pelatihan</Eyebrow>
          <span id="daftar-title" className="sr-only">
            Daftar pelatihan {category.name}
          </span>
          {category.trainings.length > 0 ? (
            <CategoryTrainingList trainings={category.trainings} />
          ) : (
            <p className="text-body text-fg-muted">Belum ada pelatihan di kategori ini.</p>
          )}
        </Container>
      </section>

      {hasAudience ? (
        <section id="peserta" aria-labelledby="peserta-title" className="scroll-mt-32 border-b border-border bg-bg-subtle py-16 md:py-20">
          <Container>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
              <div className="md:col-span-4">
                <Eyebrow>03 / Target peserta</Eyebrow>
                <h2 id="peserta-title" className="mt-3 text-h2 text-fg-strong">
                  Siapa yang cocok ikut
                </h2>
                <p className="mt-4 max-w-[40ch] text-body text-fg-muted">
                  Rangkuman target peserta dari pelatihan di kategori ini.
                </p>
                {category.audienceSource === "auto" && category.audience.length > 0 ? (
                  <p className="mt-4 inline-flex items-center gap-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                    <span aria-hidden className="inline-block size-1.5 rounded-full bg-accent" />
                    Dirangkum dari {formatNumber(category.trainingCount)} pelatihan
                  </p>
                ) : null}
              </div>
              <ul className="divide-y divide-border md:col-span-7 md:col-start-6">
                {category.audience.map((item, index) => (
                  <li key={index} className="flex items-center gap-4 py-3.5">
                    <UserIcon aria-hidden strokeWidth={1.5} className="size-5 shrink-0 text-secondary" />
                    <span className="min-w-0 flex-1 text-body text-fg-strong">{item.label}</span>
                    {item.trainingCount !== null ? (
                      <span className="shrink-0 font-mono text-label uppercase tracking-[0.08em] text-fg-muted tabular-nums">
                        {item.trainingCount} pelatihan
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      ) : null}

      {/* CTA penutup: permukaan biru (palet D). */}
      <section aria-labelledby="kategori-cta" data-surface="secondary" className="relative overflow-hidden bg-inverse-bg py-24 text-inverse-fg md:py-28">
        <GrainOverlay tone="inverse" />
        <Container className="relative">
          <Eyebrow className="text-accent-on-dark">Konsultasi / In-house</Eyebrow>
          <h2 id="kategori-cta" className="mt-3 max-w-[18ch] text-h1">
            Butuh pelatihan {category.name} untuk tim Anda?
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {hasMarketing ? (
              <ContactPanelTrigger className={buttonVariants({ variant: "inverse", size: "lg" })}>
                Hubungi marketing <span aria-hidden className="ml-2">→</span>
              </ContactPanelTrigger>
            ) : (
              <Link href="/kontak" className={buttonVariants({ variant: "inverse", size: "lg" })}>
                Hubungi marketing <span aria-hidden className="ml-2">→</span>
              </Link>
            )}
            <Link href={`/jadwal?kategori=${category.slug}`} className={buttonVariants({ variant: "inverseOutline", size: "lg" })}>
              Lihat jadwal
            </Link>
          </div>
          <RotatingBadge
            href="/kontak"
            text="Konsultasi • Hubungi marketing •"
            label="Hubungi marketing"
            tone="light"
            className="absolute top-1/2 right-4 hidden -translate-y-1/2 md:block lg:right-6"
          />
        </Container>
      </section>
    </>
  );
}
