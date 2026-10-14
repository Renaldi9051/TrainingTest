// Lompat ke field bertanda data-anchor (search global admin). Router Next memperbarui hash lewat
// pushState tanpa event hashchange, jadi palette juga mengirim event ini saat tujuannya halaman yang
// sedang dibuka; detail = hash tujuan (mis. "#field-site.contact.whatsapp").
export const FOCUS_ANCHOR_EVENT = "admin:focus-anchor";

const FOCUSABLE = [
  "input:not([type=hidden]):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "button:not([disabled])",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// Gulir ke elemen bertanda anchor lalu fokus ke kontrol pertamanya. false kalau belum ada di DOM.
export function focusAnchor(anchor: string): boolean {
  const target = document.querySelector<HTMLElement>(`[data-anchor="${CSS.escape(anchor)}"]`);
  if (!target) return false;
  const control = target.matches(FOCUSABLE) ? target : target.querySelector<HTMLElement>(FOCUSABLE);
  target.scrollIntoView({ block: "center" });
  (control ?? target).focus({ preventScroll: true });
  return true;
}
