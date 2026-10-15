import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { BrandMark } from "@/components/decor/brand-mark";
import { Container } from "@/components/ui/container";
import { getMediaPartners, getNav, getSettings, Tag } from "@/lib/api/public";
import type { PublicNavItem, SocialPlatform } from "@/lib/api/types";
import { SiteLogo } from "./site-logo";

const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  other: "Tautan",
};

// Tautan footer: garis bawah memanjang dari kiri saat hover/fokus (DESIGN.md 9.2 Link).
const footerLink =
  "relative self-start rounded-sm text-small text-inverse-fg/80 outline-none transition-colors duration-150 hover:text-inverse-fg focus-visible:text-inverse-fg focus-visible:ring-2 focus-visible:ring-inverse-fg focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-bg after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-standard hover:after:scale-x-100";

function FooterHeading({ children }: { children: string }) {
  return <h2 className="mb-1.5 font-mono text-label font-medium uppercase tracking-[0.08em] text-inverse-fg/60">{children}</h2>;
}

function NavColumn({ label, items }: { label: string; items: PublicNavItem[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={label} className="lg:col-span-2">
      <FooterHeading>{label}</FooterHeading>
      <ul className="mt-3 flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={`${item.label}-${item.href}`} className="flex">
            <Link href={item.href} className={footerLink}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Footer hitam (section terbalik #2 per halaman, mockup): merek + deskripsi + sosial | Jelajahi
// (menu header tingkat atas) | Bantuan (menu footer) | Kantor (kontak + peta kecil). Semua isi dari
// CMS; kolom kosong tidak dirender. Di-cache utuh supaya tahun hak cipta aman dihitung saat render;
// diperbarui lewat tag settings/nav.
export async function SiteFooter() {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.SETTINGS, Tag.NAV, Tag.MEDIA, Tag.MEDIA_PARTNERS);

  const [settings, nav, partners] = await Promise.all([getSettings(), getNav(), getMediaPartners()]);
  const { identity, contact, social, footer } = settings;
  const year = new Date().getFullYear();
  const emails = [contact.email, contact.emailSecondary].filter(Boolean);
  const hasOffice = Boolean(contact.address || contact.phone || emails.length > 0 || contact.whatsappUrl || contact.mapEmbedUrl);

  return (
    <footer className="mt-auto border-t border-inverse-line bg-inverse-bg text-inverse-fg">
      <Container className="grid gap-12 pt-20 pb-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-4 lg:col-span-4">
          <p className="flex items-center gap-2.5 text-[18px] font-semibold tracking-[-0.02em]">
            {identity.logoDark ? null : <BrandMark />}
            <SiteLogo logo={identity.logoDark} name={identity.name} />
          </p>
          {footer.description ? (
            <p className="max-w-[40ch] text-small text-inverse-fg/70">{footer.description}</p>
          ) : null}
          {social.links.length > 0 ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2" aria-label="Sosial media">
              {social.links.map((link) => (
                <li key={link.url} className="flex">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className={footerLink}>
                    {link.label || SOCIAL_LABELS[link.platform]}
                    <span className="sr-only"> (tab baru)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <NavColumn label="Jelajahi" items={nav.header.filter((item) => item.href !== "/")} />
        <NavColumn label="Bantuan" items={nav.footer} />

        {hasOffice ? (
          <div className="lg:col-span-4">
            <FooterHeading>Kantor</FooterHeading>
            <address className="mt-3 space-y-3 text-small not-italic">
              {contact.address ? <p className="whitespace-pre-line text-inverse-fg/85">{contact.address}</p> : null}
              {contact.phone || emails.length > 0 ? (
                <p className="flex flex-col gap-1.5">
                  {contact.phone ? (
                    <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={footerLink}>
                      {contact.phone}
                    </a>
                  ) : null}
                  {emails.map((email) => (
                    <a key={email} href={`mailto:${email}`} className={footerLink}>
                      {email}
                    </a>
                  ))}
                </p>
              ) : null}
              {contact.whatsappUrl ? (
                <p className="flex">
                  <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className={footerLink}>
                    WhatsApp +{contact.whatsapp}
                    <span className="sr-only"> (tab baru)</span>
                  </a>
                </p>
              ) : null}
            </address>
            {contact.mapEmbedUrl ? (
              <div className="group/map relative mt-5 h-32 overflow-hidden border border-inverse-line">
                {/* URL sudah divalidasi domainnya di BE; iframe dibuat di sini, bukan HTML dari CMS.
                    Monokrom seperti foto (DESIGN 2); berwarna saat hover atau fokus di dalam peta. */}
                <iframe
                  src={contact.mapEmbedUrl}
                  title={`Peta lokasi ${identity.name}`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 h-full w-full grayscale transition-[filter] duration-300 ease-standard group-hover/map:grayscale-0 group-focus-within/map:grayscale-0 motion-reduce:transition-none"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {partners.length > 0 ? (
          <div className="border-t border-inverse-line pt-8 sm:col-span-2 lg:col-span-12">
            <FooterHeading>Media partner</FooterHeading>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {partners.map((partner, index) => (
                <li key={`${partner.name}-${index}`} className="flex">
                  {partner.url ? (
                    <a href={partner.url} target="_blank" rel="noopener noreferrer" className={footerLink}>
                      {partner.name}
                      <span className="sr-only"> (tab baru)</span>
                    </a>
                  ) : (
                    <span className="text-small text-inverse-fg/80">{partner.name}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Container>
      <div className="border-t border-inverse-line">
        <Container className="flex flex-col gap-2 py-6 text-[13px] text-inverse-fg/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {footer.copyright || identity.name}
          </p>
        </Container>
      </div>
    </footer>
  );
}
