import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { Container } from "@/components/ui/container";
import { getNav, getSettings, Tag } from "@/lib/api/public";
import type { SocialPlatform } from "@/lib/api/types";
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

const footerLink =
  "rounded-sm text-small text-inverse-fg/80 outline-none transition-colors duration-150 hover:text-inverse-fg focus-visible:ring-2 focus-visible:ring-inverse-fg focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-bg";

function FooterHeading({ children }: { children: string }) {
  return <h2 className="font-mono text-label uppercase tracking-[0.08em] text-inverse-fg/60">{children}</h2>;
}

// Footer gelap (section terbalik #2 per halaman). Di-cache utuh supaya tahun hak cipta aman
// dihitung saat render; diperbarui lewat tag settings/nav.
export async function SiteFooter() {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.SETTINGS, Tag.NAV, Tag.MEDIA);

  const [settings, nav] = await Promise.all([getSettings(), getNav()]);
  const { identity, contact, social, footer } = settings;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-inverse-bg text-inverse-fg">
      <Container className="grid gap-12 py-20 md:grid-cols-12 md:py-24">
        <div className="space-y-6 md:col-span-5">
          <SiteLogo logo={identity.logoDark} name={identity.name} />
          {footer.description ? (
            <p className="max-w-[44ch] text-body text-inverse-fg/80">{footer.description}</p>
          ) : null}
          {social.links.length > 0 ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Sosial media">
              {social.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className={footerLink}>
                    {link.label || SOCIAL_LABELS[link.platform]}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {nav.footer.length > 0 ? (
          <nav aria-label="Menu footer" className="space-y-4 md:col-span-3">
            <FooterHeading>Tautan</FooterHeading>
            <ul className="space-y-2">
              {nav.footer.map((item) => (
                <li key={`${item.label}-${item.href}`}>
                  <Link href={item.href} className={footerLink}>
                    {item.label}
                  </Link>
                  {item.children.length > 0 ? (
                    <ul className="mt-2 space-y-2 pl-4">
                      {item.children.map((child) => (
                        <li key={`${child.label}-${child.href}`}>
                          <Link href={child.href} className={footerLink}>
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="space-y-4 md:col-span-4">
          <FooterHeading>Kontak</FooterHeading>
          <address className="space-y-2 not-italic">
            {contact.address ? <p className="text-small whitespace-pre-line text-inverse-fg/80">{contact.address}</p> : null}
            {contact.phone ? (
              <p>
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={footerLink}>
                  {contact.phone}
                </a>
              </p>
            ) : null}
            {contact.email ? (
              <p>
                <a href={`mailto:${contact.email}`} className={footerLink}>
                  {contact.email}
                </a>
              </p>
            ) : null}
            {contact.whatsappUrl ? (
              <p>
                <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className={footerLink}>
                  WhatsApp +{contact.whatsapp}
                </a>
              </p>
            ) : null}
          </address>
        </div>

        {contact.mapEmbedUrl ? (
          <div className="relative aspect-[16/7] overflow-hidden border border-inverse-fg/20 md:col-span-12">
            {/* URL sudah divalidasi domainnya di BE; iframe dibuat di sini, bukan HTML dari CMS. */}
            <iframe
              src={contact.mapEmbedUrl}
              title={`Peta lokasi ${identity.name}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 h-full w-full grayscale"
            />
          </div>
        ) : null}
      </Container>
      <div className="border-t border-inverse-fg/15">
        <Container className="flex flex-col gap-2 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-label uppercase tracking-[0.08em] text-inverse-fg/60">
            © {year} {footer.copyright || identity.name}
          </p>
        </Container>
      </div>
    </footer>
  );
}
