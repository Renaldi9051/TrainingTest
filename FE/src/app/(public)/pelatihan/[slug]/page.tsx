import { MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/public/json-ld";
import { PublicImage } from "@/components/public/public-image";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { ScheduleTable } from "@/components/public/schedule-table";
import { SectionHeading } from "@/components/public/section-heading";
import { TrainingGrid } from "@/components/public/training-card";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getSettings, getTraining, getTrainingSlugs } from "@/lib/api/public";
import { getTrainingPreview } from "@/lib/api/preview";
import type { PublicTrainingDetail } from "@/lib/api/types";
import { getEnv } from "@/lib/env";
import { METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
import { PREVIEW_EXIT } from "@/lib/session";
import { courseJsonLd, scheduleEventJsonLd, whatsappTrainingUrl } from "@/lib/structured-data";

// Seluruh halaman harus statis (dari cache): slug yang belum di-prerender ditunggu sampai render
// lengkap sebelum respons dikirim, jadi slug yang tidak ada mendapat HTTP 404 sungguhan
// (bukan 200 dari App Shell yang sudah ter-stream).
export const ensureStatic = "navigation";
// Navigasi ke slug yang belum di-cache memang memblokir sampai render selesai (itulah yang
// membuat 404 bisa dikirim sebelum streaming); validasi instant dimatikan untuk segmen ini.
export const instant = false;

// Slug yang tidak pernah valid dipakai kalau BE belum bisa dihubungi saat build (wajib >= 1 param).
const BUILD_PLACEHOLDER = "__placeholder";

export async function generateStaticParams() {
  try {
    const slugs = await getTrainingSlugs(50);
    if (slugs.length > 0) return slugs.map((slug) => ({ slug }));
  } catch {
    // BE tidak terjangkau saat build: halaman dibuat saat diminta pertama kali.
  }
  return [{ slug: BUILD_PLACEHOLDER }];
}

async function loadTraining(slug: string): Promise<{ training: PublicTrainingDetail; preview: boolean } | null> {
  if (slug === BUILD_PLACEHOLDER) return null;
  // Draft mode hanya aktif setelah sesi admin dicek di /admin/preview.
  if ((await draftMode()).isEnabled) {
    const preview = await getTrainingPreview(slug);
    if (preview) return { training: preview, preview: true };
  }
  const training = await getTraining(slug);
  return training ? { training, preview: false } : null;
}

export async function generateMetadata({ params }: PageProps<"/pelatihan/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadTraining(slug);
  if (!loaded) return { title: "Pelatihan tidak ditemukan" };
  const { training, preview } = loaded;
  const description = training.seo.description || training.summary || undefined;
  const image = training.seo.ogImage;
  return {
    title: training.seo.title || training.title,
    description,
    alternates: { canonical: `/pelatihan/${training.slug}` },
    openGraph: {
      type: "website",
      title: training.seo.title || training.title,
      description,
      url: `/pelatihan/${training.slug}`,
      images: image ? [{ url: image.url, alt: image.alt ?? training.title }] : undefined,
    },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function TrainingPage({ params }: PageProps<"/pelatihan/[slug]">) {
  const { slug } = await params;
  const [loaded, settings] = await Promise.all([loadTraining(slug), getSettings()]);
  if (!loaded) notFound();
  const { training, preview } = loaded;
  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL;
  const whatsapp = settings.contact.whatsapp ? whatsappTrainingUrl(settings.contact.whatsapp, training.title) : null;

  const sections = [
    { id: "deskripsi", label: "Deskripsi", html: training.bodyHtml },
    { id: "tujuan", label: "Tujuan", html: training.objectivesHtml },
    { id: "materi", label: "Materi", html: training.syllabusHtml },
    { id: "peserta", label: "Target peserta", html: training.audienceHtml },
    { id: "fasilitas", label: "Fasilitas", html: training.facilitiesHtml },
  ].filter((section): section is { id: string; label: string; html: string } => Boolean(section.html));

  const meta = [
    { label: "Durasi", value: training.duration },
    { label: "Metode", value: training.method ? METHOD_LABELS[training.method] : null },
    { label: "Tipe", value: training.types.length > 0 ? training.types.map((type) => TYPE_LABELS[type]).join(", ") : null },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));

  return (
    <>
      {preview ? <PreviewBanner path={`/pelatihan/${training.slug}`} /> : null}
      <JsonLd
        data={[
          courseJsonLd(training, siteUrl, settings.identity.name),
          ...training.schedules
            .filter((schedule) => schedule.status !== "COMPLETED")
            .map((schedule) =>
              scheduleEventJsonLd({ ...schedule, title: training.title, slug: training.slug }, siteUrl, settings.identity.name),
            ),
        ]}
      />

      <Container className="pt-10 md:pt-16">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
            <li>
              <Link href="/pelatihan" className="underline-offset-4 hover:text-fg-strong hover:underline">
                Pelatihan
              </Link>
            </li>
            {training.categories[0] ? (
              <>
                <li aria-hidden>/</li>
                <li>
                  <Link
                    href={`/pelatihan/kategori/${training.categories[0].slug}`}
                    className="underline-offset-4 hover:text-fg-strong hover:underline"
                  >
                    {training.categories[0].name}
                  </Link>
                </li>
              </>
            ) : null}
          </ol>
        </nav>

        <div className="mt-8 grid gap-10 md:mt-12 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <h1 className="max-w-[22ch] text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
              {training.title}
            </h1>
            {training.summary ? (
              <p className="mt-6 max-w-[65ch] text-body-lg text-fg-muted">{training.summary}</p>
            ) : null}
            {meta.length > 0 ? (
              <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-border pt-6 sm:grid-cols-3">
                {meta.map((item) => (
                  <div key={item.label}>
                    <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{item.label}</dt>
                    <dd className="mt-2 text-body text-fg-strong">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="mt-10 flex flex-wrap gap-3">
              {whatsapp ? (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "primary", size: "lg" })}
                >
                  <MessageCircleIcon strokeWidth={1.5} aria-hidden />
                  Tanya via WhatsApp
                  <ButtonArrow />
                </a>
              ) : null}
              <a href="#jadwal" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Lihat jadwal
              </a>
            </div>
          </div>
          {training.cover ? (
            <div className="relative aspect-[4/3] overflow-hidden bg-bg-muted lg:col-span-5">
              <PublicImage image={training.cover} sizes="(min-width: 1024px) 500px, 100vw" priority />
            </div>
          ) : null}
        </div>
      </Container>

      <Container className="mt-20 grid gap-16 md:mt-32 lg:grid-cols-12 lg:gap-12">
        <div className="space-y-16 lg:col-span-8">
          {sections.length > 0 ? (
            sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="border-t border-border pt-8">
                <SectionHeading index={String(index + 1).padStart(2, "0")} eyebrow={section.label} />
                <h2 id={`${section.id}-title`} className="sr-only">
                  {section.label}
                </h2>
                <RichTextHtml html={section.html} className="mt-6" />
              </section>
            ))
          ) : (
            <p className="border-t border-border pt-8 text-body text-fg-muted">
              Detail materi akan segera dilengkapi. Hubungi kami untuk informasi lengkap.
            </p>
          )}
        </div>

        <aside className="lg:col-span-4" aria-label="Investasi">
          <div className="space-y-4 border-t border-fg-strong pt-6 lg:sticky lg:top-24">
            <Eyebrow>Investasi</Eyebrow>
            <p className="text-[24px] leading-[1.25] font-medium text-fg-strong">
              {training.showPrice && training.priceText ? training.priceText : "Hubungi marketing"}
            </p>
            <p className="text-small text-fg-muted">
              {training.types.includes("IN_HOUSE")
                ? "Tersedia juga sebagai pelatihan in-house untuk tim Anda."
                : "Hubungi kami untuk penawaran kelompok."}
            </p>
            {whatsapp ? (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`${buttonVariants({ variant: "ghost" })} gap-2`}>
                Chat WhatsApp
                <ButtonArrow />
              </a>
            ) : null}
          </div>
        </aside>
      </Container>

      <Container as="section" id="jadwal" aria-labelledby="jadwal-title" className="mt-20 scroll-mt-24 md:mt-32">
        <SectionHeading eyebrow="Jadwal" title="Jadwal terdekat" id="jadwal-title" />
        <div className="mt-10">
          {training.schedules.length > 0 ? (
            <ScheduleTable rows={training.schedules} caption={`Jadwal ${training.title}`} />
          ) : (
            <div className="border-t border-border py-10">
              <p className="text-body text-fg-strong">Belum ada jadwal public yang dibuka.</p>
              <p className="mt-2 max-w-[65ch] text-small text-fg-muted">
                Pelatihan ini bisa diadakan sebagai in-house atau dijadwalkan sesuai kebutuhan tim Anda.
              </p>
            </div>
          )}
          <Link href="/jadwal" className={`${buttonVariants({ variant: "ghost" })} mt-8 gap-2`}>
            Semua jadwal pelatihan
            <ButtonArrow />
          </Link>
        </div>
      </Container>

      {training.related.length > 0 ? (
        <Container as="section" aria-labelledby="terkait-title" className="mt-20 mb-24 md:mt-32 md:mb-32">
          <SectionHeading eyebrow="Pelatihan terkait" title="Mungkin juga relevan" id="terkait-title" />
          <div className="mt-10">
            <TrainingGrid trainings={training.related} />
          </div>
        </Container>
      ) : (
        <div className="mb-24 md:mb-32" />
      )}
    </>
  );
}

function PreviewBanner({ path }: { path: string }) {
  return (
    <div role="status" className="border-b border-fg-strong bg-bg-subtle">
      <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-strong">
          Mode pratinjau · konten mungkin belum tayang
        </p>
        <form action={PREVIEW_EXIT} method="post">
          <input type="hidden" name="path" value={path} />
          <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Keluar dari pratinjau
          </button>
        </form>
      </Container>
    </div>
  );
}
