import { MessageCircleIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { FloatingContactSync } from "@/components/public/floating-contact-sync";
import { PublicImage } from "@/components/public/public-image";
import { getMarketing } from "@/lib/api/public";
import type { PublicMarketingContact } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { marketingMessage, whatsappLink } from "@/lib/whatsapp";

// Floating contact (DESIGN.md 7, PRD 4.5): tombol bulat kanan bawah membuka panel daftar marketing.
// Panel dirender server dan dibuka dengan Popover API native (popovertarget): Esc, klik di luar,
// dan fokus kembali ke tombol ditangani browser, tanpa JS. Browser tanpa dukungan popover (atau
// FloatingContactSync menandai html[data-popover="off"]) mendapat tautan ke daftar marketing di
// /kontak, jadi tombol tidak pernah diam saat diklik (public.css: .popover-trigger/.popover-fallback).

export const CONTACT_PANEL_ID = "kontak-marketing";
export const CONTACT_FALLBACK_HREF = "/kontak#tim-marketing";

type ContactWithWhatsapp = PublicMarketingContact & { whatsappUrl: string };

export function contactsWithWhatsapp(marketing: PublicMarketingContact[]): ContactWithWhatsapp[] {
  return marketing.filter((person): person is ContactWithWhatsapp => Boolean(person.whatsappUrl));
}

// Pembuka panel: <button popovertarget> kalau didukung, selain itu tautan ke /kontak. Keduanya
// dirender; CSS menampilkan salah satu. Dipakai tombol bulat dan tombol "Chat WA" di bar CTA mobile.
export function ContactPanelTrigger({ className, label, children }: { className: string; label?: string; children: ReactNode }) {
  return (
    <>
      <button type="button" popoverTarget={CONTACT_PANEL_ID} aria-label={label} className={cn("popover-trigger", className)}>
        {children}
      </button>
      <a href={CONTACT_FALLBACK_HREF} aria-label={label} className={cn("popover-fallback", className)}>
        {children}
      </a>
    </>
  );
}

export async function FloatingContact() {
  const contacts = contactsWithWhatsapp(await getMarketing());
  // Belum ada kontak marketing: tombol tidak dirender sama sekali.
  if (contacts.length === 0) return null;

  return (
    <>
      {/* Mobile: disembunyikan di halaman yang punya bar CTA bawah (public.css: data-contact-bar).
          Border terang tipis supaya tombol tetap terlihat di atas footer gelap. Palet D: --primary. */}
      <div className="floating-contact fixed right-4 bottom-4 z-30 md:right-6 md:bottom-6">
        <ContactPanelTrigger
          label="Hubungi marketing"
          className="inline-flex size-14 items-center justify-center rounded-full border border-inverse-fg/30 bg-primary text-on-primary outline-none transition-colors duration-150 ease-standard hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <MessageCircleIcon aria-hidden strokeWidth={1.5} className="size-6" />
        </ContactPanelTrigger>
      </div>

      <div
        id={CONTACT_PANEL_ID}
        popover="auto"
        role="dialog"
        aria-labelledby={`${CONTACT_PANEL_ID}-title`}
        className="contact-panel m-0 max-h-[80dvh] w-full overflow-y-auto border-x-0 border-t border-b-0 border-border bg-bg p-0 text-fg backdrop:bg-fg-strong/40 md:max-h-[min(32rem,calc(100dvh-8rem))] md:w-[360px] md:rounded-card md:border md:backdrop:bg-transparent"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border py-2 pr-2 pl-5">
          <h2 id={`${CONTACT_PANEL_ID}-title`} className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">
            Hubungi marketing
          </h2>
          <button
            type="button"
            popoverTarget={CONTACT_PANEL_ID}
            popoverTargetAction="hide"
            aria-label="Tutup"
            className="inline-flex size-10 items-center justify-center rounded-md text-fg-muted outline-none hover:bg-bg-subtle hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-focus"
          >
            <XIcon aria-hidden strokeWidth={1.5} className="size-5" />
          </button>
        </div>
        <ul className="divide-y divide-border">
          {contacts.map((person, index) => (
            <li key={`${person.name}-${index}`} className="flex items-center gap-4 px-5 py-4">
              <span className="relative size-12 shrink-0 overflow-hidden rounded-full bg-bg-muted">
                {person.photo ? <PublicImage image={{ ...person.photo, alt: person.photo.alt || person.name }} sizes="48px" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium text-fg-strong">{person.name}</span>
                {person.area ? (
                  <span className="block truncate font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{person.area}</span>
                ) : null}
                <span className="block font-mono text-small text-fg-muted">+{person.phone}</span>
              </span>
              {/* href awal = pesan tanpa topik; FloatingContactSync menggantinya saat panel dibuka. */}
              <a
                href={whatsappLink(person.phone, marketingMessage(person, null))}
                target="_blank"
                rel="noopener noreferrer"
                autoFocus={index === 0}
                data-wa-phone={person.phone}
                data-wa-name={person.name}
                data-wa-default={person.defaultMessage ?? undefined}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-border-strong px-3 text-small text-fg outline-none transition-colors duration-150 ease-standard hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-focus"
              >
                <MessageCircleIcon aria-hidden strokeWidth={1.5} className="size-4" />
                Chat WA
                <span className="sr-only"> dengan {person.name} (tab baru)</span>
              </a>
            </li>
          ))}
        </ul>
        <FloatingContactSync panelId={CONTACT_PANEL_ID} />
      </div>
    </>
  );
}
