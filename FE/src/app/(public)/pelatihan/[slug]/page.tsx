import { MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Accordion } from "@/components/public/accordion";
import { JsonLd } from "@/components/public/json-ld";
import { PreviewBanner } from "@/components/public/preview-banner";
import { PublicImage } from "@/components/public/public-image";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { ScheduleTable } from "@/components/public/schedule-table";
import { TrainingGrid } from "@/components/public/training-card";
import { ReadingProgress } from "@/components/motion/reading-progress";
import { ContactContext } from "@/components/public/contact-context";
import { ContactPanelTrigger, contactsWithWhatsapp } from "@/components/public/floating-contact";
import { InquiryDialog } from "@/components/public/inquiry-dialog";
import { ScrollSpyToc } from "@/components/motion/scroll-spy-toc";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getMarketing, getSettings, getTraining } from "@/lib/api/public";
import { getTrainingPreview } from "@/lib/api/preview";
import type { PublicTrainingDetail } from "@/lib/api/types";
import { getPublicEnv } from "@/lib/env";
import { formatDateRange, formatRupiah } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/labels";
import { privacyPolicyHref } from "@/lib/privacy";
import { courseJsonLd, scheduleEventJsonLd } from "@/lib/structured-data";
import { cn } from "@/lib/utils";
import { whatsappTrainingUrl } from "@/lib/whatsapp";

// Seluruh halaman harus statis (dari cache): slug yang belum di-prerender ditunggu sampai render
// lengkap sebelum respons dikirim, jadi slug yang tidak ada mendapat HTTP 404 sungguhan
// (bukan 200 dari App Shell yang sudah ter-stream).
export const ensureStatic = "navigation";
// Navigasi ke slug yang belum di-cache memang memblokir sampai render selesai (itulah yang
// membuat 404 bisa dikirim sebelum streaming); validasi instant dimatikan untuk segmen ini.
export const instant = false;

// Slug yang tidak pernah valid memenuhi syarat build. Ribuan halaman detail dibuat saat pertama
// kali diminta, lalu di-cache; proses startup tidak membanjiri koneksi database.
const BUILD_PLACEHOLDER = "__placeholder";

export async function generateStaticParams() {
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
const IN_HOUSE_LABEL = "Minta penawaran in-house";

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
  const [loaded, settings, privacyHref, marketing] = await Promise.all([
    loadTraining(slug),
    getSettings(),
    privacyPolicyHref(),
    getMarketing(),
  ]);
  if (!loaded) notFound();
  const { training, preview } = loaded;
  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  const whatsappNumber = settings.contact.whatsapp;
  const cta = whatsappNumber
    ? {
        chat: whatsappTrainingUrl(whatsappNumber, training.title),
      }
    : null;
  // Ada marketing: "Chat WA" di bar mobile membuka panel floating contact (pilih marketing, pesan
  // berisi judul pelatihan) dan tombol bulat disembunyikan di mobile (data-contact-bar).
  const marketingPanel = contactsWithWhatsapp(marketing).length > 0;
  // Form inquiry (dialog) dengan pelatihan ini terisi; tombol utama kalau WhatsApp belum diatur.
  const inquiryButton = (
    <InquiryDialog
      label={IN_HOUSE_LABEL}
      training={{ slug: training.slug, title: training.title }}
      siteName={settings.identity.name}
      privacyHref={privacyHref}
      variant={cta ? "secondary" : "primary"}
    />
  );

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
    { id: "jadwal", label: "Jadwal & investasi", content: <ScheduleSection training={training} inquiry={inquiryButton} /> },
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
      <ReadingProgress />
      <ContactContext topic={{ kind: "training", title: training.title }} bar={Boolean(cta) && marketingPanel} />
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
      <div className={cn("bg-[#fafafa]", cta && "pb-24 lg:pb-0")}>
        <Container className="grid gap-8 pt-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0 rounded-2xl bg-white p-6 shadow-[0_2px_12px_rgb(0_0_0_/_0.12)] md:p-8">
            <div className="relative mb-6 flex aspect-video items-center justify-center overflow-hidden bg-[#0b417f] text-center text-white">
              {training.cover ? (
                <PublicImage image={training.cover} sizes="(min-width: 1024px) 800px, 100vw" grayscale={false} priority />
              ) : (
                <span className="max-w-[24ch] px-8 text-[24px] font-bold uppercase md:text-[36px]">{training.title}</span>
              )}
            </div>
            <h1 data-page-enter="" className="text-[25px] leading-[1.2] font-bold text-[#111] uppercase md:text-[30px]">{training.title}</h1>
            {training.categories.length > 0 ? (
              <p className="mt-3 flex flex-wrap gap-2 text-[13px] text-[#0b417f]">
                {training.categories.map((category) => (
                  <Link key={category.slug} href={`/pelatihan/kategori/${category.slug}`} className="underline-offset-4 hover:underline">{category.name}</Link>
                ))}
              </p>
            ) : null}
            {training.summary ? <p className="mt-5 text-[16px] leading-relaxed text-[#555]">{training.summary}</p> : null}
            <details open className="mt-6 rounded-2xl border-2 border-[#191919]">
              <summary className="cursor-pointer px-5 py-4 text-[17px] font-semibold">Daftar Isi</summary>
              <nav aria-label="Daftar isi" className="border-t border-[#191919] px-5 py-4">
                <TocLinks sections={sections} spy={false} />
              </nav>
            </details>
            <dl className="mt-8 grid grid-cols-2 gap-4 border-y border-border py-5" aria-label="Ringkasan pelatihan">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-[12px] font-semibold text-[#777] uppercase">{fact.label}</dt>
                  <dd className="mt-1 text-[14px] font-medium text-[#111]">{fact.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-10 space-y-12">
              {sections.map((section) => (
                <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
                  <h2 id={`${section.id}-title`} className="mb-5 text-[23px] font-bold text-[#111]">{section.label}</h2>
                  {section.content}
                </section>
              ))}
            </div>
          </article>
          <aside aria-label="Pencarian dan kontak" className="space-y-8">
            <div>
              <h2 className="border-b-4 border-[#111] pb-2 text-[18px] font-semibold">Pencarian</h2>
              <form action="/pelatihan" role="search" className="mt-7 flex overflow-hidden rounded-xl border-2 border-[#0b417f]">
                <label htmlFor="detail-search" className="sr-only">Cari pelatihan</label>
                <input id="detail-search" type="search" name="q" className="min-w-0 flex-1 px-4 py-3 outline-none" />
                <button type="submit" className="bg-[#0b417f] px-5 text-white" aria-label="Cari pelatihan">⌕</button>
              </form>
            </div>
            <div>
              <h2 className="border-b-4 border-[#111] pb-2 text-[18px] font-semibold">Kontak Kami</h2>
              <div className="mt-7 space-y-4">
                {contactsWithWhatsapp(marketing).map((person) => (
                  <div key={person.name} className="rounded-2xl bg-white p-6 text-center shadow-[0_2px_12px_rgb(0_0_0_/_0.14)]">
                    <p className="text-[18px] font-semibold text-[#111]">{person.name}</p>
                    <p className="mt-1 text-[13px] text-[#888]">Konsultasi pelatihan</p>
                    <a href={person.whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0b417f] px-5 py-2 text-[14px] font-semibold text-white">
                      <MessageCircleIcon className="size-4" aria-hidden /> WhatsApp {person.phone}
                    </a>
                  </div>
                ))}
              </div>
              <div className="mt-5">{inquiryButton}</div>
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
        <div data-contact-bar={marketingPanel ? "" : undefined} className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg lg:hidden">
          <Container className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                {nextScheduleText(training)}
              </p>
              <p className="truncate text-small font-medium text-fg-strong">{investmentText(training)}</p>
            </div>
            {marketingPanel ? (
              <ContactPanelTrigger className={buttonVariants({ variant: "primary", size: "md" })}>
                <MessageCircleIcon strokeWidth={1.5} aria-hidden />
                Chat WA
              </ContactPanelTrigger>
            ) : (
              <a
                href={cta.chat}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                <MessageCircleIcon strokeWidth={1.5} aria-hidden />
                Chat WA
              </a>
            )}
          </Container>
        </div>
      ) : null}
    </>
  );
}

// Desktop: menandai bagian yang sedang dibaca (scroll-spy). Mobile (di dalam <details>): link saja.
function TocLinks({ sections, className, spy = true }: { sections: Section[]; className?: string; spy?: boolean }) {
  return <ScrollSpyToc sections={sections.map(({ id, label }) => ({ id, label }))} className={className} spy={spy} />;
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

function ScheduleSection({ training, inquiry }: { training: PublicTrainingDetail; inquiry: ReactNode }) {
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
      {/* Layar kecil: panel samping tidak tampil, jadi tombol penawaran in-house ada di sini. */}
      <div className="lg:hidden">{inquiry}</div>
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
