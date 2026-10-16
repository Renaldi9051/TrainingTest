import { ExternalLinkIcon, MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HudLabel } from "@/components/decor/hud-label";
import { PlusMarker } from "@/components/decor/plus-marker";
import { ContactInquiry } from "@/components/public/contact-inquiry";
import { PageHero } from "@/components/public/page-hero";
import { PublicImage } from "@/components/public/public-image";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getMarketing, getSettings } from "@/lib/api/public";
import { privacyPolicyHref } from "@/lib/privacy";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Hubungi kami",
  alternates: { canonical: "/kontak" },
};

// Label UI bawaan; diganti isi Pengaturan > Kepala halaman kalau diisi.
const DEFAULT_TITLE = "Hubungi kami";
const linkClass = "underline-offset-4 outline-none hover:underline focus-visible:underline";

// Kontak (PRD 5.9, mockup kontak.html): strip info kantor, peta, tim marketing, form inquiry. Semua isi
// dari pengaturan situs & modul Kontak marketing; bagian yang kosong tidak ditampilkan.
export default async function ContactPage() {
  const [settings, marketing, privacyHref] = await Promise.all([getSettings(), getMarketing(), privacyPolicyHref()]);
  const { contact, identity } = settings;
  const header = settings.pageHeaders.kontak;
  const emails = [contact.email, contact.emailSecondary].filter(Boolean);
  const coordinates = contact.latitude !== null && contact.longitude !== null ? { lat: contact.latitude, lon: contact.longitude } : null;

  type Fact = { label: string; content: ReactNode };
  const candidates: (Fact | null)[] = [
    contact.address
      ? { label: "Alamat", content: <p className="text-[18px] leading-[1.5] whitespace-pre-line text-fg-strong">{contact.address}</p> }
      : null,
    contact.phone || emails.length > 0 || contact.whatsappUrl
      ? {
          label: "Telepon dan email",
          content: (
            <ul className="space-y-1 text-[18px] leading-[1.5] text-fg-strong">
              {contact.phone ? (
                <li>
                  <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.whatsappUrl ? (
                <li>
                  <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    WhatsApp +{contact.whatsapp}
                    <span className="sr-only"> (tab baru)</span>
                  </a>
                </li>
              ) : null}
              {emails.map((email) => (
                <li key={email}>
                  <a href={`mailto:${email}`} className={linkClass}>
                    {email}
                  </a>
                </li>
              ))}
            </ul>
          ),
        }
      : null,
    contact.openingHours
      ? { label: "Jam operasional", content: <p className="text-[18px] leading-[1.5] whitespace-pre-line text-fg-strong">{contact.openingHours}</p> }
      : null,
  ];
  const facts = candidates.filter((fact): fact is Fact => fact !== null);

  return (
    <>
      <PageHero
        crumbs={[{ label: header.heading || "Kontak" }]}
        eyebrow={header.eyebrow || undefined}
        title={header.heading || DEFAULT_TITLE}
        lead={header.lead || identity.tagline || null}
        outline="Kontak"
      />

      {facts.length > 0 ? (
        <Container>
          <dl className={cn("grid border-b border-border", facts.length > 1 && "md:grid-cols-3")}>
            {facts.map((fact, index) => (
              <div
                key={fact.label}
                className={cn("relative py-8 md:pr-6", index > 0 && "border-t border-border md:border-t-0 md:border-l md:pl-6")}
              >
                <PlusMarker className="-bottom-1.5 -left-1.5" />
                {index === facts.length - 1 ? <PlusMarker className="-right-1.5 -bottom-1.5" /> : null}
                <dt className="mb-3 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{fact.label}</dt>
                <dd>{fact.content}</dd>
              </div>
            ))}
          </dl>
        </Container>
      ) : null}

      {contact.mapEmbedUrl || marketing.length > 0 ? (
        <Container className="grid grid-cols-1 gap-12 py-20 md:py-24 lg:grid-cols-12 lg:items-start lg:gap-6">
          {contact.mapEmbedUrl ? (
            <div className={cn("group/map relative aspect-[4/3] overflow-hidden border border-border focus-within:ring-2 focus-within:ring-fg-strong focus-within:ring-offset-2", marketing.length > 0 ? "lg:col-span-6" : "lg:col-span-12 lg:aspect-[16/7]")}>
              {/* URL sudah divalidasi domainnya di BE. Monokrom seperti foto; berwarna saat hover/fokus. */}
              <iframe
                src={contact.mapEmbedUrl}
                title={`Peta lokasi ${identity.name}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 h-full w-full grayscale transition-[filter] duration-300 ease-standard group-hover/map:grayscale-0 group-focus-within/map:grayscale-0 motion-reduce:transition-none"
              />
              {coordinates ? (
                <>
                  <HudLabel className="pointer-events-none absolute top-4 left-4 bg-bg px-2 py-1">
                    {`Lat ${coordinates.lat} / Lon ${coordinates.lon}`}
                  </HudLabel>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lon}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "absolute right-4 bottom-4 gap-2 bg-bg")}
                  >
                    Buka di Google Maps
                    <ExternalLinkIcon aria-hidden strokeWidth={1.5} className="size-3.5" />
                    <span className="sr-only"> (tab baru)</span>
                  </a>
                </>
              ) : null}
            </div>
          ) : null}

          {marketing.length > 0 ? (
            // Tujuan cadangan floating contact (browser tanpa Popover API): /kontak#tim-marketing.
            <section
              id="tim-marketing"
              aria-labelledby="marketing-title"
              className={cn("scroll-mt-24", contact.mapEmbedUrl ? "lg:col-span-5 lg:col-start-8" : "lg:col-span-7")}
            >
              <Eyebrow>Tim marketing</Eyebrow>
              <h2 id="marketing-title" className="mt-3 mb-6 text-h2 text-fg-strong">
                Chat langsung
              </h2>
              <ul className="border-b border-border">
                {marketing.map((person, index) => (
                  <li key={`${person.name}-${index}`} className="flex items-center gap-4 border-t border-border py-4">
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-bg-muted">
                      {person.photo ? <PublicImage image={{ ...person.photo, alt: person.photo.alt || person.name }} sizes="56px" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-medium text-fg-strong">{person.name}</span>
                      {person.area ? (
                        <span className="mt-1 block font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{person.area}</span>
                      ) : null}
                      <span className="mt-1 block font-mono text-small text-fg-muted">+{person.phone}</span>
                    </span>
                    {person.whatsappUrl ? (
                      <a
                        href={person.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "primary", size: "md" }), "gap-2")}
                      >
                        <MessageCircleIcon aria-hidden strokeWidth={1.5} className="size-4" />
                        Chat WA
                        <span className="sr-only"> dengan {person.name} lewat WhatsApp (tab baru)</span>
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </Container>
      ) : null}

      <section id="inquiry" aria-labelledby="form-title" className="scroll-mt-24 bg-bg-subtle py-20 md:py-28">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-4">
            <Eyebrow>Form inquiry</Eyebrow>
            <h2 id="form-title" className="mt-4 text-h2 text-fg-strong">
              Kirim pesan
            </h2>
            <p className="mt-4 max-w-[45ch] text-body text-fg-muted">
              Ceritakan kebutuhan pelatihan tim Anda. Kami membalas lewat email atau WhatsApp.
            </p>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactInquiry siteName={identity.name} privacyHref={privacyHref} />
          </div>
        </Container>
      </section>
    </>
  );
}
