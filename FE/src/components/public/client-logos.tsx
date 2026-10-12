import type { PublicClient } from "@/lib/api/types";
import { PublicImage } from "./public-image";

const LOGO_SIZES = "(min-width: 1024px) 200px, (min-width: 640px) 25vw, 50vw";

// Logo klien grayscale + opacity 60%, hover/fokus 100% (DESIGN 2). Tanpa logo: nama klien sebagai
// wordmark mono. Marquee berjalan menyusul di Fase 4 (VelocityMarquee); daftar ini tetap jadi isinya.
export function ClientLogos({ clients }: { clients: PublicClient[] }) {
  return (
    <ul className="grid grid-cols-2 border-t border-l border-border sm:grid-cols-4 lg:grid-cols-6">
      {clients.map((client, index) => {
        const content = client.logo ? (
          <span className="relative block h-12 w-full">
            {/* Alt logo = nama klien kalau alt di media library kosong. */}
            <PublicImage
              image={{ ...client.logo, alt: client.logo.alt || client.name }}
              sizes={LOGO_SIZES}
              fit="contain"
            />
          </span>
        ) : (
          <span className="font-mono text-label uppercase tracking-[0.08em] text-fg-strong">{client.name}</span>
        );
        const box =
          "flex h-28 items-center justify-center border-r border-b border-border px-6 opacity-60 transition-opacity duration-150 ease-standard";
        return (
          <li key={`${client.name}-${index}`}>
            {client.url ? (
              <a
                href={client.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${box} outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-fg-strong`}
              >
                {content}
                <span className="sr-only"> (tab baru)</span>
              </a>
            ) : (
              <div className={`${box} hover:opacity-100`}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
