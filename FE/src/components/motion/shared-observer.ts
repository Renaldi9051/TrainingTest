import { IN_VIEW_MARGIN } from "./tokens";

// Satu IntersectionObserver bersama untuk semua baris RevealRows di halaman (bukan satu per baris).
// Callback dipanggil sekali per elemen yang masuk viewport (margin -10%, DESIGN.md 8.2).
type Handler = (element: Element) => void;

let observer: IntersectionObserver | null = null;
const handlers = new Map<Element, Handler>();

function sharedObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const handler = handlers.get(entry.target);
        unobserveOnce(entry.target);
        handler?.(entry.target);
      }
    },
    { rootMargin: IN_VIEW_MARGIN },
  );
  return observer;
}

export function observeOnce(element: Element, handler: Handler) {
  handlers.set(element, handler);
  sharedObserver().observe(element);
}

export function unobserveOnce(element: Element) {
  handlers.delete(element);
  observer?.unobserve(element);
}
