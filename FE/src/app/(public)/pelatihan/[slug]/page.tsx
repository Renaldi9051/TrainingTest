import { CheckIcon, MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { HudLabel } from "@/components/decor/hud-label";
import { Viewfinder } from "@/components/decor/viewfinder";
import { ReadingProgress } from "@/components/motion/reading-progress";
import { RevealImage } from "@/components/motion/reveal-parts";
import { RevealRows } from "@/components/motion/reveal-rows";
import { ScrollSpyToc } from "@/components/motion/scroll-spy-toc";
import { Accordion } from "@/components/public/accordion";
import { ContactContext } from "@/components/public/contact-context";
import { ContactPanelTrigger, contactsWithWhatsapp } from "@/components/public/floating-contact";
import { InquiryForm } from "@/components/public/inquiry-form";
import { JsonLd } from "@/components/public/json-ld";
import { Breadcrumb } from "@/components/public/page-hero";
import { PreviewBanner } from "@/components/public/preview-banner";
import { PublicImage } from "@/components/public/public-image";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { ScheduleTable } from "@/components/public/schedule-table";
import { TrainingGrid } from "@/components/public/training-card";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getMarketing, getSettings, getTraining } from "@/lib/api/public";
import { getTrainingPreview } from "@/lib/api/preview";
import type { PublicImage as PublicImageData, PublicTrainingDetail } from "@/lib/api/types";
import { displayTitle, isUntitled } from "@/lib/display-title";
import { getPublicEnv } from "@/lib/env";
import { APP_TIME_ZONE, dateBadgeParts, formatDateRange, formatRupiah } from "@/lib/format";
import { LEVEL_LABELS, METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
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
  const title = training.seo.title || displayTitle(training.title);
  return {
    title,
    description,
    alternates: { canonical: `/pelatihan/${training.slug}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: `/pelatihan/${training.slug}`,
      images: image ? [{ url: image.url, alt: image.alt ?? title }] : undefined,
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

function typesText(training: PublicTrainingDetail): string {
  const labels = training.types.map((type) => TYPE_LABELS[type]);
  return labels.length === 2 ? `${labels[0]} dan ${labels[1].toLowerCase()}` : labels.join(", ");
}

// "OKT 2026" untuk label DIPERBARUI.
function monthYear(value: string): string {
  return new Date(value)
    .toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: APP_TIME_ZONE })
    .replace(".", "")
    .toUpperCase();
}

const pad = (value: number) => String(value).padStart(2, "0");

type Section = { id: string; label: string; content: ReactNode };

// Detail pelatihan (mockup pelatihan-detail): kepala (chip kategori, h1, ringkasan, strip fakta),
// foto ber-Viewfinder kalau ada sampul, satu navigasi isi berupa tab sticky dengan scroll-spy,
// kartu harga sticky di kanan (desktop), form inquiry inline, pelatihan terkait.
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
  // Data lama bisa berjudul kosong: tampil label UI "Tanpa judul" (heading tidak kosong).
  const title = displayTitle(training.title);
  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;
  const whatsappNumber = settings.contact.whatsapp;
  const cta = whatsappNumber ? { chat: whatsappTrainingUrl(whatsappNumber, title) } : null;
  // Ada marketing: "Chat WA" (bar mobile & kartu samping) membuka panel floating contact (pilih
  // marketing, pesan berisi judul pelatihan); tombol bulat disembunyikan di mobile (data-contact-bar).
  const marketingPanel = contactsWithWhatsapp(marketing).length > 0;
  const next = training.nextSchedule;
  const nextBadge = next ? dateBadgeParts(next.startDate) : null;
  const primaryCategory = training.categories[0] ?? null;
  // Sesi yang masih bisa dipilih di form inquiry (DIBUKA, atau PENUH sebagai daftar tunggu).
  const sessions = training.schedules
    .filter((schedule) => schedule.status !== "COMPLETED")
    .map((schedule) => ({
      id: schedule.id,
      label: [
        formatDateRange(schedule.startDate, schedule.endDate),
        schedule.city ?? METHOD_LABELS[schedule.method],
        schedule.status === "FULL" ? "penuh, daftar tunggu" : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }));

  // Bagian kosong tidak dirender dan tidak masuk tab. #jadwal selalu tampil.
  const candidates: (Section | null)[] = [
    training.descriptionHtml
      ? { id: "deskripsi", label: "Deskripsi", content: <RichTextHtml html={training.descriptionHtml} /> }
      : null,
    training.outcomes.length > 0
      ? { id: "hasil-belajar", label: "Hasil belajar", content: <OutcomeList outcomes={training.outcomes} /> }
      : null,
    training.modules.length > 0 ? { id: "materi", label: "Materi", content: <ModuleList training={training} /> } : null,
    training.images.length > 0
      ? { id: "galeri", label: "Galeri", content: <TrainingGallery images={training.images} /> }
      : null,
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

  // Strip fakta (mockup): yang kosong disembunyikan.
  const facts = [
    training.duration ? { label: "Durasi", value: training.duration } : null,
    training.method ? { label: "Metode", value: METHOD_LABELS[training.method] } : null,
    training.types.length > 0 ? { label: "Tipe", value: typesText(training) } : null,
    training.certificate !== null ? { label: "Sertifikat", value: training.certificate ? "Ya" : "Tidak" } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  const chatButton = cta ? (
    marketingPanel ? (
      <ContactPanelTrigger className={buttonVariants({ variant: "primary", size: "lg" })}>
        <MessageCircleIcon strokeWidth={1.5} aria-hidden />
        Chat WhatsApp
      </ContactPanelTrigger>
    ) : (
      <a href={cta.chat} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "primary", size: "lg" })}>
        <MessageCircleIcon strokeWidth={1.5} aria-hidden />
        Chat WhatsApp
      </a>
    )
  ) : null;

  return (
    <>
      {preview ? <PreviewBanner path={`/pelatihan/${training.slug}`} /> : null}
      <ReadingProgress />
      <ContactContext topic={{ kind: "training", title }} bar={Boolean(cta) && marketingPanel} />
      <JsonLd
        data={[
          courseJsonLd({ ...training, title }, siteUrl, settings.identity.name),
          ...training.schedules
            .filter((schedule) => schedule.status !== "COMPLETED")
            .map((schedule) =>
              scheduleEventJsonLd({ ...schedule, title, slug: training.slug }, siteUrl, settings.identity.name),
            ),
        ]}
      />

      {/* Ruang di bawah untuk bar CTA mobile. */}
      <div className={cn(cta && "pb-24 lg:pb-0")}>
        <section className="pt-12 pb-10 md:pt-14 md:pb-12">
          <Container>
            <Breadcrumb
              crumbs={[
                { label: "Pelatihan", href: "/pelatihan" },
                ...(primaryCategory ? [{ label: primaryCategory.name, href: `/pelatihan/kategori/${primaryCategory.slug}` }] : []),
                { label: title },
              ]}
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                {training.categories.length > 0 || training.level ? (
                  <ul data-page-enter="" aria-label="Kategori dan tingkat" className="mb-5 flex flex-wrap gap-2">
                    {training.categories.map((category) => (
                      <li key={category.slug}>
                        <Link
                          href={`/pelatihan/kategori/${category.slug}`}
                          className="inline-flex h-7 items-center rounded-full border border-border-strong px-3 text-[12px] text-fg outline-none transition-colors duration-150 hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                        >
                          {category.name}
                        </Link>
                      </li>
                    ))}
                    {training.level ? (
                      <li className="inline-flex h-7 items-center rounded-full border border-border px-3 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                        <span className="sr-only">Tingkat </span>
                        {LEVEL_LABELS[training.level]}
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                <h1
                  data-page-enter=""
                  className={cn("max-w-[24ch] text-h1", isUntitled(training.title) ? "text-fg-muted" : "text-fg-strong")}
                >
                  {title}
                </h1>
              </div>
              {training.summary ? (
                <p data-page-enter="" className="max-w-[65ch] text-body-lg text-fg-muted lg:col-span-4">
                  {training.summary}
                </p>
              ) : null}
            </div>

            {facts.length > 0 ? (
              <dl
                aria-label="Fakta pelatihan"
                className={cn("mt-10 grid grid-cols-2 border-y border-border", facts.length > 2 && "md:grid-cols-4")}
              >
                {facts.map((fact, index) => (
                  // dt lebih dulu di DOM, nilai tampil di bawah label.
                  <div
                    key={fact.label}
                    className={cn(
                      "py-4 pr-4",
                      index % 2 === 1 && "border-l border-border pl-4 md:pl-6",
                      index >= 2 && "border-t border-border md:border-t-0",
                      index > 0 && "md:border-l md:pl-6",
                    )}
                  >
                    <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{fact.label}</dt>
                    <dd className="mt-1.5 text-[18px] leading-[1.4] font-medium text-fg-strong">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </Container>
        </section>

        {/* Sampul pelatihan, atau gambar kategori kalau sampul kosong (alt dari media kategori).
            Tanpa keduanya: tanpa blok gambar (aturan konten 6, bukan placeholder). */}
        {training.cover ? (
          <Container>
            <div data-training-cover="" data-cover-source={training.coverSource ?? "none"} className="relative aspect-4/3 overflow-hidden bg-bg-muted sm:aspect-video lg:aspect-auto lg:h-130">
              <PublicImage image={training.cover} sizes="(min-width: 1280px) 1232px, 100vw" priority />
              <Viewfinder
                className="inset-4 md:inset-6"
                topLeft={
                  nextBadge ? <HudLabel tone="photo">{`Sesi berikut / ${nextBadge.day} ${nextBadge.monthYear}`}</HudLabel> : undefined
                }
              />
              {next?.city ? (
                <HudLabel tone="photo" className="absolute right-8 bottom-7 md:right-14 md:bottom-10">
                  {`Lokasi / ${next.city}`}
                </HudLabel>
              ) : null}
            </div>
          </Container>
        ) : null}

        <Container className="grid grid-cols-1 gap-x-6 pb-20 md:pb-24 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-8">
            {/* Satu-satunya navigasi isi: tab sticky di bawah header (desktop & mobile). */}
            <nav aria-label="Isi pelatihan" className="sticky top-18 z-20 border-b border-border bg-bg">
              <ScrollSpyToc sections={sections.map(({ id, label }) => ({ id, label }))} orientation="horizontal" />
            </nav>
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="scroll-mt-36 border-b border-border py-12 last:border-b-0 md:py-14"
              >
                <h2
                  id={`${section.id}-title`}
                  className="mb-6 font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted"
                >
                  <span aria-hidden>{pad(index + 1)} / </span>
                  {section.label}
                </h2>
                {section.content}
              </section>
            ))}
          </div>

          <aside
            aria-label="Ringkasan pendaftaran"
            className="hidden lg:sticky lg:top-36 lg:col-span-4 lg:col-start-9 lg:mt-14 lg:block"
          >
            {/* Palet C: kartu harga radius 12 px dengan garis atas 4 px --accent. */}
            <div className="rounded-card border border-t-4 border-border border-t-accent bg-bg p-6 xl:p-8">
              <dl>
                <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Investasi</dt>
                <dd className="mt-2 text-[28px] leading-[1.15] font-semibold tracking-[-0.03em] text-fg-strong">
                  {investmentText(training)}
                </dd>
                <div className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 border-y border-border py-5 text-small">
                  <dt className="text-fg-muted">Sesi terdekat</dt>
                  <dd className="text-right font-medium text-fg-strong">
                    {next ? formatDateRange(next.startDate, next.endDate) : SCHEDULE_FLEXIBLE}
                  </dd>
                  {next ? (
                    <>
                      <dt className="text-fg-muted">Lokasi</dt>
                      <dd className="text-right font-medium text-fg-strong">{next.city ?? METHOD_LABELS[next.method]}</dd>
                    </>
                  ) : null}
                </div>
              </dl>
              <div className="mt-6 flex flex-col gap-2.5">
                {chatButton}
                <a href="#inquiry" className={buttonVariants({ variant: cta ? "secondary" : "primary", size: "lg" })}>
                  Kirim inquiry
                </a>
              </div>
              {cta ? <p className="mt-4 text-small text-fg-muted">Pesan WhatsApp otomatis berisi judul pelatihan ini.</p> : null}
            </div>
            <p className="mt-4 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
              Diperbarui {monthYear(training.updatedAt)}
            </p>
          </aside>
        </Container>

        <section id="inquiry" aria-labelledby="inquiry-title" className="scroll-mt-24 bg-bg-subtle py-20 md:py-24">
          <Container className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-4">
              <Eyebrow>Inquiry</Eyebrow>
              <h2 id="inquiry-title" className="mt-4 text-h2 text-fg-strong">
                Tanya atau daftar pelatihan ini
              </h2>
              <p className="mt-4 max-w-[45ch] text-body text-fg-muted">
                Tim kami membalas lewat email atau WhatsApp. Data Anda hanya dipakai untuk menindaklanjuti permintaan ini.
              </p>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <InquiryForm
                siteName={settings.identity.name}
                privacyHref={privacyHref}
                source="TRAINING_DETAIL"
                training={{ slug: training.slug, title }}
                sessions={sessions}
              />
            </div>
          </Container>
        </section>

        <Container>
          {training.disclaimer ? (
            <p className="mt-16 max-w-[65ch] border-t border-border pt-6 text-small text-fg-muted">{training.disclaimer}</p>
          ) : null}
          {training.related.length > 0 ? (
            <section aria-labelledby="terkait-title" className="mt-20 mb-24 md:mt-24 md:mb-32">
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Eyebrow>Pelatihan terkait</Eyebrow>
                  <h2 id="terkait-title" className="mt-3 text-h2 text-fg-strong">
                    Mungkin juga relevan
                  </h2>
                </div>
                {primaryCategory ? (
                  <Link
                    href={`/pelatihan/kategori/${primaryCategory.slug}`}
                    className={cn(buttonVariants({ variant: "ghost" }), "gap-2")}
                  >
                    Lihat kategori {primaryCategory.name}
                    <ButtonArrow />
                  </Link>
                ) : null}
              </div>
              <TrainingGrid trainings={training.related} />
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

function OutcomeList({ outcomes }: { outcomes: string[] }) {
  return (
    <ol className="border-b border-border">
      {outcomes.map((outcome, index) => (
        <li key={`${index}-${outcome}`} className="grid grid-cols-[56px_minmax(0,1fr)] gap-3 border-t border-border py-4">
          <span className="pt-0.5 font-mono text-small text-accent-ink">{pad(index + 1)}</span>
          <span className="text-body text-fg">{outcome}</span>
        </li>
      ))}
    </ol>
  );
}

// Galeri foto kegiatan (terpisah dari sampul): grid 2 kolom 4:3, berwarna. Jumlah ganjil = foto
// pertama selebar dua kolom supaya grid tidak menyisakan lubang.
function TrainingGallery({ images }: { images: PublicImageData[] }) {
  const wideFirst = images.length % 2 === 1;
  return (
    <RevealRows as="ul" kind="card" className="grid gap-4 sm:grid-cols-2">
      {images.map((image, index) => {
        const wide = wideFirst && index === 0;
        return (
          <li key={image.url} className={cn("min-w-0", wide && "sm:col-span-2")}>
            <RevealImage className={cn("relative overflow-hidden bg-bg-muted", wide ? "aspect-4/3 sm:aspect-video" : "aspect-4/3")}>
              <PublicImage
                image={image}
                sizes={wide ? "(min-width: 1280px) 816px, (min-width: 1024px) 66vw, 100vw" : "(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"}
              />
            </RevealImage>
          </li>
        );
      })}
    </RevealRows>
  );
}

// Silabus: modul dengan nomor hari tampil "HARI 01"; tanpa hari tetap bernomor urut.
function ModuleList({ training }: { training: PublicTrainingDetail }) {
  return (
    <Accordion
      label="materi"
      toggleAll
      items={training.modules.map((module, index) => ({
        id: `modul-${index + 1}`,
        title: (
          <>
            <span className="mr-3 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
              {module.day ? `Hari ${pad(module.day)}` : pad(index + 1)}
            </span>
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
        <ScheduleTable rows={training.schedules} caption={`Jadwal ${displayTitle(training.title)}`} bigDate />
      ) : (
        <p className="border-y border-border py-6 text-body text-fg-strong">
          {SCHEDULE_FLEXIBLE}. Belum ada sesi public yang dibuka.
        </p>
      )}
      {training.inHouseNote ? <p className="max-w-[65ch] text-small text-fg-muted">{training.inHouseNote}</p> : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* Layar kecil: kartu samping tidak tampil, jadi tombol inquiry ada di sini. */}
        <a href="#inquiry" className={cn(buttonVariants({ variant: "secondary" }), "lg:hidden")}>
          Kirim inquiry
        </a>
        <Link href="/jadwal" className={`${buttonVariants({ variant: "ghost" })} gap-2`}>
          Semua jadwal pelatihan
          <ButtonArrow />
        </Link>
      </div>
    </div>
  );
}

function FacilityList({ facilities }: { facilities: string[] }) {
  return (
    <ul className="grid border-t border-l border-border sm:grid-cols-2 xl:grid-cols-3">
      {facilities.map((facility, index) => (
        <li key={`${index}-${facility}`} className="flex items-start gap-3 border-r border-b border-border p-5 text-body text-fg">
          <CheckIcon aria-hidden strokeWidth={1.5} className="mt-1 size-5 shrink-0 text-primary" />
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
