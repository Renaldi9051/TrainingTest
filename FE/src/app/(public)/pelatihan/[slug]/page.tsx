import { ChevronDownIcon, MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Accordion } from "@/components/public/accordion";
import { JsonLd } from "@/components/public/json-ld";
import { PublicImage } from "@/components/public/public-image";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { ScheduleTable } from "@/components/public/schedule-table";
import { TrainingGrid } from "@/components/public/training-card";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getSettings, getTraining, getTrainingSlugs } from "@/lib/api/public";
import { getTrainingPreview } from "@/lib/api/preview";
import type { PublicTrainingDetail } from "@/lib/api/types";
import { getPublicEnv } from "@/lib/env";
import { formatDateRange, formatRupiah } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/labels";
import { PREVIEW_EXIT } from "@/lib/session";
import {
  courseJsonLd,
  scheduleEventJsonLd,
  whatsappInHouseUrl,
  whatsappTrainingUrl,
} from "@/lib/structured-data";
import { cn } from "@/lib/utils";

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

const PRICE_HIDDEN = "Hubungi marketing";
const SCHEDULE_FLEXIBLE = "Jadwal menyesuaikan";

// Harga sesi termurah -> teks investasi -> "Hubungi marketing" (diputuskan BE lewat `investment`).
function investmentText(training: PublicTrainingDetail): string {
  const { investment } = training;
  if (!investment) return PRICE_HIDDEN;
  return investment.type === "from" ? `mulai ${formatRupiah(investment.amount)}` : investment.text;
}

function nextScheduleText(training: PublicTrainingDetail): string {
  const next = training.nextSchedule;
  if (!next) return SCHEDULE_FLEXIBLE;
  const place = next.city ?? METHOD_LABELS[next.method];
  return `${formatDateRange(next.startDate, next.endDate)} · ${place}`;
}

type Section = { id: string; label: string; content: ReactNode };

export default async function TrainingPage({ params }: PageProps<"/pelatihan/[slug]">) {
  const { slug } = await params;
  const [loaded, settings] = await Promise.all([loadTraining(slug), getSettings()]);
  if (!loaded) notFound();
  const { training, preview } = loaded;
  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  const whatsappNumber = settings.contact.whatsapp;
  const cta = whatsappNumber
    ? {
        chat: whatsappTrainingUrl(whatsappNumber, training.title),
        // Sementara via WhatsApp; diganti form inquiry di Fase 4 (BACKLOG).
        inHouse: whatsappInHouseUrl(whatsappNumber, training.title),
      }
    : null;

  // Bagian kosong tidak dirender dan tidak masuk daftar isi. #jadwal selalu tampil.
  const candidates: (Section | null)[] = [
    training.descriptionHtml
      ? { id: "deskripsi", label: "Deskripsi", content: <RichTextHtml html={training.descriptionHtml} /> }
      : null,
    training.outcomes.length > 0
      ? { id: "hasil-belajar", label: "Hasil belajar", content: <OutcomeList outcomes={training.outcomes} /> }
      : null,
    training.modules.length > 0 ? { id: "materi", label: "Materi", content: <ModuleList training={training} /> } : null,
    training.audience.length > 0 || training.prerequisites
      ? { id: "peserta", label: "Peserta", content: <AudienceList training={training} /> }
      : null,
    { id: "jadwal", label: "Jadwal & investasi", content: <ScheduleSection training={training} /> },
    training.facilities.length > 0
      ? { id: "fasilitas", label: "Fasilitas", content: <FacilityList facilities={training.facilities} /> }
      : null,
    training.faq.length > 0 ? { id: "faq", label: "FAQ", content: <FaqList training={training} /> } : null,
  ];
  const sections = candidates.filter((section): section is Section => section !== null);

  const facts = [
    training.duration ? { label: "Durasi", value: training.duration } : null,
    training.method ? { label: "Metode", value: METHOD_LABELS[training.method] } : null,
    { label: "Jadwal terdekat", value: nextScheduleText(training) },
    { label: "Investasi", value: investmentText(training) },
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

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

      {/* Ruang di bawah untuk bar CTA mobile. */}
      <div className={cn(cta && "pb-24 lg:pb-0")}>
        <Container className="pt-10 md:pt-16">
          {training.categories.length > 0 ? (
            <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
              {training.categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/pelatihan/kategori/${category.slug}`}
                  className="underline-offset-4 hover:text-fg-strong hover:underline"
                >
                  {category.name}
                </Link>
              ))}
            </p>
          ) : (
            <Eyebrow>Pelatihan</Eyebrow>
          )}
          <h1 className="mt-4 max-w-[22ch] text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
            {training.title}
          </h1>
          {training.summary ? (
            <p className="mt-6 max-w-[65ch] text-body-lg text-fg-muted">{training.summary}</p>
          ) : null}

          <dl className="mt-10 grid grid-cols-2 border-y border-border md:grid-cols-4" aria-label="Ringkasan pelatihan">
            {facts.map((fact, index) => (
              <div
                key={fact.label}
                className={cn(
                  "py-4 pr-4",
                  index % 2 === 1 && "border-l border-border pl-4",
                  index >= 2 && "border-t border-border md:border-t-0",
                  index > 0 && "md:border-l md:pl-4",
                )}
              >
                <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{fact.label}</dt>
                <dd className="mt-2 font-mono text-small text-fg-strong">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <MobileToc sections={sections} />

          {training.cover ? (
            <div className="relative mt-10 aspect-video overflow-hidden bg-bg-muted">
              <PublicImage image={training.cover} sizes="(min-width: 1280px) 1232px, 100vw" priority />
            </div>
          ) : null}
        </Container>

        <Container className="mt-12 grid gap-12 md:mt-20 lg:grid-cols-[180px_minmax(0,1fr)_260px] xl:grid-cols-[200px_minmax(0,1fr)_300px]">
          <nav aria-label="Daftar isi" className="hidden lg:block">
            <div className="sticky top-24">
              <Eyebrow>Daftar isi</Eyebrow>
              <TocLinks sections={sections} className="mt-4" />
            </div>
          </nav>

          <div className="min-w-0 space-y-16">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="scroll-mt-24 border-t border-border pt-8"
              >
                <Eyebrow index={String(index + 1).padStart(2, "0")}>{section.label}</Eyebrow>
                <h2 id={`${section.id}-title`} className="sr-only">
                  {section.label}
                </h2>
                <div className="mt-6">{section.content}</div>
              </section>
            ))}
          </div>

          <aside aria-label="Daftar & konsultasi" className="hidden lg:block">
            <div className="sticky top-24 space-y-6 border-t border-fg-strong pt-6">
              <div>
                <Eyebrow>Jadwal terdekat</Eyebrow>
                <p className="mt-2 text-body font-medium text-fg-strong">{nextScheduleText(training)}</p>
              </div>
              <div>
                <Eyebrow>Investasi</Eyebrow>
                <p className="mt-2 text-body font-medium text-fg-strong">{investmentText(training)}</p>
              </div>
              {cta ? (
                <div className="flex flex-col gap-3">
                  <a
                    href={cta.chat}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "primary", size: "lg" })}
                  >
                    <MessageCircleIcon strokeWidth={1.5} aria-hidden />
                    Chat WA
                    <ButtonArrow />
                  </a>
                  <a
                    href={cta.inHouse}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "secondary", size: "lg" })}
                  >
                    Minta penawaran in-house
                  </a>
                </div>
              ) : null}
            </div>
          </aside>
        </Container>

        <Container className="mt-20 md:mt-32">
          {training.disclaimer ? (
            <p className="max-w-[65ch] border-t border-border pt-6 text-small text-fg-muted">{training.disclaimer}</p>
          ) : null}
          {training.related.length > 0 ? (
            <section aria-labelledby="terkait-title" className="mt-16 mb-24 md:mt-24 md:mb-32">
              <Eyebrow>Pelatihan terkait</Eyebrow>
              <h2
                id="terkait-title"
                className="mt-3 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg-strong md:text-[40px]"
              >
                Mungkin juga relevan
              </h2>
              <div className="mt-10">
                <TrainingGrid trainings={training.related} />
              </div>
            </section>
          ) : (
            <div className="mb-24 md:mb-32" />
          )}
        </Container>
      </div>

      {cta ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg lg:hidden">
          <Container className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                {nextScheduleText(training)}
              </p>
              <p className="truncate text-small font-medium text-fg-strong">{investmentText(training)}</p>
            </div>
            <a
              href={cta.chat}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              <MessageCircleIcon strokeWidth={1.5} aria-hidden />
              Chat WA
            </a>
          </Container>
        </div>
      ) : null}
    </>
  );
}

function TocLinks({ sections, className }: { sections: Section[]; className?: string }) {
  return (
    <ol className={cn("space-y-2", className)}>
      {sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="rounded-sm text-small text-fg-muted underline-offset-4 outline-none hover:text-fg-strong hover:underline focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
          >
            {section.label}
          </a>
        </li>
      ))}
    </ol>
  );
}

function MobileToc({ sections }: { sections: Section[] }) {
  return (
    <details className="group mt-6 border-b border-border pb-4 lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-label uppercase tracking-[0.08em] text-fg-strong">Daftar isi</span>
        <ChevronDownIcon
          className="size-4 text-fg-muted transition-transform duration-150 group-open:rotate-180"
          strokeWidth={1.5}
          aria-hidden
        />
      </summary>
      <nav aria-label="Daftar isi (mobile)">
        <TocLinks sections={sections} className="mt-3" />
      </nav>
    </details>
  );
}

function OutcomeList({ outcomes }: { outcomes: string[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {outcomes.map((outcome, index) => (
        <li key={`${index}-${outcome}`} className="flex gap-4 py-4">
          <span className="font-mono text-small text-fg-muted">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-body text-fg">{outcome}</span>
        </li>
      ))}
    </ol>
  );
}

function ModuleList({ training }: { training: PublicTrainingDetail }) {
  return (
    <Accordion
      label="materi"
      toggleAll
      items={training.modules.map((module, index) => ({
        id: `modul-${index + 1}`,
        title: (
          <>
            <span className="mr-3 font-mono text-small text-fg-muted">{String(index + 1).padStart(2, "0")}</span>
            {module.title}
          </>
        ),
        meta: module.durationMinutes ? `${module.durationMinutes} menit` : undefined,
        content:
          module.points.length > 0 ? (
            <ul className="space-y-2 pl-9">
              {module.points.map((point, pointIndex) => (
                <li key={`${pointIndex}-${point}`} className="list-disc text-body text-fg marker:text-fg-muted">
                  {point}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pl-9 text-small text-fg-muted">Rincian poin disampaikan saat pelatihan.</p>
          ),
      }))}
    />
  );
}

function AudienceList({ training }: { training: PublicTrainingDetail }) {
  return (
    <div className="space-y-6">
      {training.audience.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {training.audience.map((item, index) => (
            <li key={`${index}-${item.role}`} className="py-4">
              <p className="text-body font-medium text-fg-strong">{item.role}</p>
              {item.note ? <p className="mt-1 text-small text-fg-muted">{item.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {training.prerequisites ? (
        <div>
          <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Prasyarat</p>
          <p className="mt-2 max-w-[65ch] text-body text-fg">{training.prerequisites}</p>
        </div>
      ) : null}
    </div>
  );
}

function ScheduleSection({ training }: { training: PublicTrainingDetail }) {
  return (
    <div className="space-y-6">
      <p className="text-body text-fg">
        Investasi: <span className="font-medium text-fg-strong">{investmentText(training)}</span>
      </p>
      {training.schedules.length > 0 ? (
        <ScheduleTable rows={training.schedules} caption={`Jadwal ${training.title}`} />
      ) : (
        <p className="border-y border-border py-6 text-body text-fg-strong">
          {SCHEDULE_FLEXIBLE}. Belum ada sesi public yang dibuka.
        </p>
      )}
      {training.inHouseNote ? <p className="max-w-[65ch] text-small text-fg-muted">{training.inHouseNote}</p> : null}
      <Link href="/jadwal" className={`${buttonVariants({ variant: "ghost" })} gap-2`}>
        Semua jadwal pelatihan
        <ButtonArrow />
      </Link>
    </div>
  );
}

function FacilityList({ facilities }: { facilities: string[] }) {
  return (
    <ul className="grid gap-x-8 sm:grid-cols-2">
      {facilities.map((facility, index) => (
        <li key={`${index}-${facility}`} className="border-b border-border py-3 text-body text-fg">
          {facility}
        </li>
      ))}
    </ul>
  );
}

function FaqList({ training }: { training: PublicTrainingDetail }) {
  return (
    <Accordion
      label="pertanyaan"
      items={training.faq.map((item, index) => ({
        id: `faq-${index + 1}`,
        title: item.q,
        content: <p className="max-w-[65ch] text-body text-fg-muted">{item.a}</p>,
      }))}
    />
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
