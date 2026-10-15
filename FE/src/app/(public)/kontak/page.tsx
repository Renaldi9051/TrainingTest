import { MailIcon, MapPinIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import type { Metadata } from "next";
import { ContactInquiry } from "@/components/public/contact-inquiry";
import { PageHero } from "@/components/public/page-hero";
import { PublicImage } from "@/components/public/public-image";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getMarketing, getSettings } from "@/lib/api/public";
import { privacyPolicyHref } from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Hubungi kami",
  alternates: { canonical: "/kontak" },
};

const linkClass = "underline-offset-4 outline-none hover:underline focus-visible:underline";

// Kontak (PRD 5.9): alamat, telepon, email, peta, daftar marketing, dan form inquiry. Semua isi
// dari pengaturan situs & modul Kontak marketing; bagian yang kosong tidak ditampilkan.
export default async function ContactPage() {
  const [settings, marketing, privacyHref] = await Promise.all([getSettings(), getMarketing(), privacyPolicyHref()]);
  const { contact, identity } = settings;
  const emails = [contact.email, contact.emailSecondary].filter(Boolean);

  return (
    <>
      <PageHero crumbs={[{ label: "Kontak" }]} title="Hubungi kami" lead={identity.tagline || null} outline="Kontak" />
      <Container className="grid gap-16 pt-12 pb-20 md:pt-16 md:pb-32 lg:grid-cols-12 lg:gap-12">
        <section aria-labelledby="form-title" className="space-y-6 lg:col-span-7">
          <h2 id="form-title" className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg-strong md:text-[40px]">
            Kirim pesan
          </h2>
          <p className="max-w-[60ch] text-body text-fg-muted">
            Ceritakan kebutuhan pelatihan tim Anda. Kami membalas lewat email atau WhatsApp.
          </p>
          <ContactInquiry siteName={identity.name} privacyHref={privacyHref} />
        </section>

        <aside aria-label="Informasi kontak" className="space-y-10 lg:col-span-5">
          <dl className="space-y-6 border-t border-fg-strong pt-6">
            {contact.address ? (
              <div className="flex gap-3">
                <MapPinIcon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                <div>
                  <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Alamat</dt>
                  <dd className="mt-1 text-body whitespace-pre-line text-fg-strong">{contact.address}</dd>
                </div>
              </div>
            ) : null}
            {contact.phone ? (
              <div className="flex gap-3">
                <PhoneIcon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                <div>
                  <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Telepon</dt>
                  <dd className="mt-1 text-body text-fg-strong">
                    <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={linkClass}>
                      {contact.phone}
                    </a>
                  </dd>
                </div>
              </div>
            ) : null}
            {emails.length > 0 ? (
              <div className="flex gap-3">
                <MailIcon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                <div>
                  <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Email</dt>
                  {emails.map((email) => (
                    <dd key={email} className="mt-1 text-body text-fg-strong">
                      <a href={`mailto:${email}`} className={linkClass}>
                        {email}
                      </a>
                    </dd>
                  ))}
                </div>
              </div>
            ) : null}
            {contact.whatsappUrl ? (
              <div className="flex gap-3">
                <MessageCircleIcon aria-hidden strokeWidth={1.5} className="mt-0.5 size-5 shrink-0 text-fg-muted" />
                <div>
                  <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">WhatsApp</dt>
                  <dd className="mt-1 text-body text-fg-strong">
                    <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                      +{contact.whatsapp}
                      <span className="sr-only"> (tab baru)</span>
                    </a>
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>

          {marketing.length > 0 ? (
            // Tujuan cadangan floating contact (browser tanpa Popover API): /kontak#tim-marketing.
            <section id="tim-marketing" aria-labelledby="marketing-title" className="scroll-mt-24 space-y-4">
              <Eyebrow id="marketing-title">Tim marketing</Eyebrow>
              <ul className="divide-y divide-border border-y border-border">
                {marketing.map((person, index) => (
                  <li key={`${person.name}-${index}`} className="flex items-center gap-4 py-4">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-bg-muted">
                      {person.photo ? <PublicImage image={{ ...person.photo, alt: person.photo.alt || person.name }} sizes="48px" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-medium text-fg-strong">{person.name}</span>
                      <span className="block font-mono text-small text-fg-muted">+{person.phone}</span>
                    </span>
                    {person.whatsappUrl ? (
                      <a
                        href={person.whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong px-3 text-small outline-none hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-fg-strong"
                      >
                        <MessageCircleIcon aria-hidden strokeWidth={1.5} className="size-4" />
                        Chat
                        <span className="sr-only"> dengan {person.name} lewat WhatsApp (tab baru)</span>
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>

        {contact.mapEmbedUrl ? (
          <div className="group/map relative aspect-[16/7] overflow-hidden border border-border lg:col-span-12">
            {/* URL sudah divalidasi domainnya di BE. Monokrom seperti foto; berwarna saat hover/fokus. */}
            <iframe
              src={contact.mapEmbedUrl}
              title={`Peta lokasi ${identity.name}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full grayscale transition-[filter] duration-300 ease-standard group-hover/map:grayscale-0 group-focus-within/map:grayscale-0 motion-reduce:transition-none"
            />
          </div>
        ) : null}
      </Container>
    </>
  );
}
