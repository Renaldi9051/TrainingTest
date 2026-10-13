import { MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PreviewBanner } from "@/components/public/preview-banner";
import { PublicImage } from "@/components/public/public-image";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { ServiceRows } from "@/components/public/service-rows";
import { SectionHeading } from "@/components/public/section-heading";
import { RollText } from "@/components/motion/roll-text";
import { buttonVariants, MAGNETIC } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getRedirect, getServices, getService, getSettings, Tag } from "@/lib/api/public";
import { getServicePreview } from "@/lib/api/preview";
import type { PublicServiceDetail } from "@/lib/api/types";
import { pageMetadata } from "@/lib/page-metadata";
import { followRedirect } from "@/lib/public-redirect";
import { whatsappServiceUrl } from "@/lib/structured-data";

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

  return (
    <>
      {preview ? <PreviewBanner path={`/layanan/${service.slug}`} /> : null}
      <Container className="grid gap-10 pt-16 pb-12 md:pt-24 md:pb-16 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-6 lg:col-span-7">
          <Eyebrow>
            <Link href="/layanan" className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-fg-strong">
              Layanan
            </Link>
          </Eyebrow>
          <h1 className="max-w-[20ch] text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
            {service.title}
          </h1>
          {service.summary ? <p className="max-w-[65ch] text-body-lg text-fg-muted">{service.summary}</p> : null}
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "primary", size: "lg" })}
              {...MAGNETIC}
            >
              <MessageCircleIcon aria-hidden strokeWidth={1.5} />
              <RollText>Konsultasi via WhatsApp</RollText>
              <span className="sr-only"> (tab baru)</span>
            </a>
          ) : null}
        </div>
        {service.image ? (
          <div className="relative aspect-[4/3] overflow-hidden bg-bg-muted lg:col-span-5">
            {/* Gambar di layar pertama: dimuat lebih dulu. */}
            <PublicImage image={service.image} sizes={SERVICE_IMAGE_SIZES} priority />
          </div>
        ) : null}
      </Container>

      {service.bodyHtml ? (
        <Container className="border-t border-border py-12 md:py-16">
          <h2 className="sr-only">Detail layanan</h2>
          <RichTextHtml html={service.bodyHtml} className="max-w-[65ch] text-body-lg text-fg" />
        </Container>
      ) : null}

      {others.length > 0 ? (
        <section aria-labelledby="layanan-lain" className="py-20 md:py-32">
          <Container className="space-y-10">
            <SectionHeading eyebrow="Layanan lain" title="Layanan lainnya" id="layanan-lain" />
            <ServiceRows services={others} />
          </Container>
        </section>
      ) : null}
    </>
  );
}
