import { MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createElement, type ReactNode } from "react";
import { GrainOverlay } from "@/components/decor/grain-overlay";
import { RotatingBadge } from "@/components/decor/rotating-badge";
import { Viewfinder } from "@/components/decor/viewfinder";
import { ReadingProgress } from "@/components/motion/reading-progress";
import { Reveal } from "@/components/motion/reveal";
import { RollText } from "@/components/motion/roll-text";
import { Accordion } from "@/components/public/accordion";
import { ContactContext } from "@/components/public/contact-context";
import { Breadcrumb } from "@/components/public/page-hero";
import { PreviewBanner } from "@/components/public/preview-banner";
import { PublicImage } from "@/components/public/public-image";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceRows } from "@/components/public/service-rows";
import { TrainingGrid } from "@/components/public/training-card";
import { ButtonArrow, buttonVariants, MAGNETIC } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getRedirect, getServices, getService, getSettings, Tag } from "@/lib/api/public";
import { getServicePreview } from "@/lib/api/preview";
import type { PublicServiceDetail } from "@/lib/api/types";
import { categoryIcon } from "@/lib/category-icons";
import { pageMetadata } from "@/lib/page-metadata";
import { followRedirect } from "@/lib/public-redirect";
import { cn } from "@/lib/utils";
import { whatsappServiceUrl } from "@/lib/whatsapp";

// Pola sama dengan detail pelatihan: halaman statis dari cache; slug baru setelah build dirender
// saat diminta; slug yang tidak ada mendapat HTTP 404 sungguhan.
export const ensureStatic = "navigation";
export const instant = false;

const BUILD_PLACEHOLDER = "__placeholder";
const SERVICE_IMAGE_SIZES = "(min-width: 1024px) 560px, calc(100vw - 32px)";

export async function generateStaticParams() {
  try {
    const services = await getServices();
    if (services.length > 0) return services.map((service) => ({ slug: service.slug }));
  } catch {
    // BE tidak terjangkau saat build: halaman dibuat saat diminta pertama kali.
  }
  return [{ slug: BUILD_PLACEHOLDER }];
}

async function loadService(slug: string): Promise<{ service: PublicServiceDetail; preview: boolean } | null> {
  if (slug === BUILD_PLACEHOLDER) return null;
  if ((await draftMode()).isEnabled) {
    const preview = await getServicePreview(slug);
    if (preview) return { service: preview, preview: true };
  }
  const service = await getService(slug);
  return service ? { service, preview: false } : null;
}

export async function generateMetadata({ params }: PageProps<"/layanan/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadService(slug);
  if (!loaded) return { title: "Layanan tidak ditemukan" };
  const { service, preview } = loaded;
  return pageMetadata({
    title: service.title,
    path: `/layanan/${service.slug}`,
    seo: service.seo,
    fallbackDescription: service.summary,
    fallbackImage: service.image,
    preview,
  });
}

const pad = (value: number) => String(value).padStart(2, "0");

// Detail layanan (mockup layanan-detail): kepala dua kolom (teks + foto ber-Viewfinder), isi detail,
// lalu bagian bernomor yang hanya tampil kalau datanya ada (benefit, pelatihan terkait, FAQ),
// layanan lain, dan CTA hitam dengan badge berputar.
export default async function ServicePage({ params }: PageProps<"/layanan/[slug]">) {
  const { slug } = await params;
  const loaded = await loadService(slug);
  if (!loaded) {
    // Slug lama yang pernah tayang (diganti admin): ikuti tabel Redirect.
    const target = slug === BUILD_PLACEHOLDER ? null : await getRedirect(`/layanan/${slug}`, Tag.service(slug));
    if (target) followRedirect(target);
    notFound();
  }
  const { service, preview } = loaded;
  const [settings, services] = await Promise.all([getSettings(), getServices()]);
  const others = services.filter((item) => item.slug !== service.slug);
  const whatsapp = settings.contact.whatsapp ? whatsappServiceUrl(settings.contact.whatsapp, service.title) : null;

  // Bagian bernomor: nomor mengikuti bagian yang tampil saja.
  type NumberedSection = { id: string; label: string; content: ReactNode; action?: ReactNode };
  const candidates: (NumberedSection | null)[] = [
    service.benefits.length > 0 ? { id: "benefit", label: "Yang Anda dapat", content: <Benefits service={service} /> } : null,
    service.trainings.length > 0
      ? {
          id: "pelatihan-terkait",
          label: "Pelatihan terkait",
          content: <TrainingGrid trainings={service.trainings} />,
          action: (
            <Link href="/pelatihan" className={cn(buttonVariants({ variant: "ghost" }), "gap-2")}>
              Lihat katalog
              <ButtonArrow />
            </Link>
          ),
        }
      : null,
    service.faqs.length > 0
      ? {
          id: "faq-layanan",
          label: "Pertanyaan umum",
          content: (
            <Accordion
              label="pertanyaan"
              items={service.faqs.map((item, index) => ({
                id: `faq-layanan-${index + 1}`,
                title: (
                  <>
                    <span className="mr-3 font-mono text-label text-fg-muted">{pad(index + 1)}</span>
                    {item.q}
                  </>
                ),
                content: <p className="max-w-[65ch] text-body text-fg-muted">{item.a}</p>,
              }))}
            />
          ),
        }
      : null,
  ];
  const sections = candidates.filter((section): section is NumberedSection => section !== null);

  const whatsappButton = (variant: "primary" | "inverse") =>
    whatsapp ? (
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ variant, size: "lg" })}
        {...MAGNETIC}
      >
        <MessageCircleIcon aria-hidden strokeWidth={1.5} />
        <RollText>Konsultasi via WhatsApp</RollText>
        <span className="sr-only"> (tab baru)</span>
      </a>
    ) : null;

  return (
    <>
      {preview ? <PreviewBanner path={`/layanan/${service.slug}`} /> : null}
      <ReadingProgress />
      <ContactContext topic={{ kind: "service", title: service.title }} />
      <section className="border-b border-border pt-12 pb-12 md:pt-14 md:pb-16">
        <Container>
          <Breadcrumb crumbs={[{ label: "Layanan", href: "/layanan" }, { label: service.title }]} />
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center lg:gap-6">
            <div className="space-y-6 lg:col-span-6">
              <div>
                <h1 data-page-enter="" className="max-w-[20ch] text-h1 text-fg-strong">
                  {service.title}
                </h1>
                {service.tagline ? (
                  <p data-page-enter="" className="mt-4 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
                    {service.tagline}
                  </p>
                ) : null}
              </div>
              {service.summary ? <p data-page-enter="" className="max-w-[65ch] text-body-lg text-fg-muted">{service.summary}</p> : null}
              <div className="flex flex-wrap gap-3">
                {whatsappButton("primary")}
                <Link href="/kontak" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                  Kirim pertanyaan
                </Link>
              </div>
            </div>
            {service.image ? (
              <div className="group relative aspect-[4/3] overflow-hidden bg-bg-muted lg:col-span-6">
                {/* Gambar di layar pertama: dimuat lebih dulu. Grayscale, berwarna saat hover. */}
                <PublicImage
                  image={service.image}
                  sizes={SERVICE_IMAGE_SIZES}
                  priority
                  film
                />
                <Viewfinder className="inset-4 md:inset-6" />
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {service.bodyHtml ? (
        <Container className="py-12 md:py-16">
          <h2 className="sr-only">Detail layanan</h2>
          <RichTextHtml html={service.bodyHtml} className="max-w-[65ch] text-body-lg text-fg" />
        </Container>
      ) : null}

      {sections.map((section, index) => (
        <section key={section.id} aria-labelledby={section.id} className="border-t border-border py-20 md:py-28">
          <Container className="space-y-10 md:space-y-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeading eyebrow={`${pad(index + 1)} / ${section.label}`} title={section.label} id={section.id} />
              {section.action}
            </div>
            {section.content}
          </Container>
        </section>
      ))}

      {others.length > 0 ? (
        <section aria-labelledby="layanan-lain" className="border-t border-border py-20 md:py-28">
          <Container className="space-y-10">
            <SectionHeading eyebrow="Layanan lain" title="Layanan lainnya" id="layanan-lain" />
            <ServiceRows services={others} />
          </Container>
        </section>
      ) : null}

      {/* CTA penutup: permukaan biru (palet D, data-surface="secondary" di palette-d.css). */}
      <section aria-labelledby="layanan-cta" data-surface="secondary" className="relative overflow-hidden bg-inverse-bg py-24 text-inverse-fg md:py-32">
        <GrainOverlay tone="inverse" />
        <Container className="relative">
          <h2 id="layanan-cta" className="max-w-[16ch] text-h1">
            Susun program untuk tim Anda.
          </h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {whatsappButton("inverse")}
            <Link href="/kontak" className={buttonVariants({ variant: "inverseOutline", size: "lg" })}>
              Hubungi kami
            </Link>
          </div>
          <RotatingBadge
            href="/kontak"
            text="Konsultasi • Hubungi kami •"
            label="Hubungi kami"
            tone="light"
            className="absolute top-1/2 right-4 hidden -translate-y-1/2 md:block lg:right-6"
          />
        </Container>
      </section>
    </>
  );
}

function BenefitIcon({ name }: { name: string | null }) {
  const icon = categoryIcon(name);
  return icon ? createElement(icon, { className: "size-6 text-fg-strong", strokeWidth: 1.5, "aria-hidden": true }) : null;
}

// Benefit: grid bergaris tanpa latar kartu (DESIGN 4).
function Benefits({ service }: { service: PublicServiceDetail }) {
  return (
    <Reveal as="ul" data-reveal-children="card" className="grid border-t border-l border-border sm:grid-cols-2 lg:grid-cols-3">
      {service.benefits.map((benefit, index) => (
        <li key={index} className="border-r border-b border-border p-6 md:p-8">
          <BenefitIcon name={benefit.icon} />
          <h3 className={cn("text-h3 text-fg-strong", benefit.icon && "mt-5")}>{benefit.title}</h3>
          {benefit.description ? <p className="mt-2 text-body text-fg-muted">{benefit.description}</p> : null}
        </li>
      ))}
    </Reveal>
  );
}
