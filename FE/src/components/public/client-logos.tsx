import type { PublicClient } from "@/lib/api/types";
import { Reveal } from "@/components/motion/reveal";
import { MARQUEE_AUTO_SPEED } from "@/components/motion/marquee-plan";
import { VelocityMarquee } from "@/components/motion/velocity-marquee";
import { PublicImage } from "./public-image";

const LOGO_SIZES = "(min-width: 1024px) 200px, (min-width: 640px) 25vw, 50vw";


// Logo klien grayscale + opacity 60%, hover/fokus 100% (DESIGN 2). Tanpa logo: nama klien sebagai
// wordmark mono. Masuk: logo membesar dari 0,92 bertahap. Gerak: satu baris yang berjalan sendiri
// pelan, dipercepat/dibalik oleh scroll (VelocityMarquee), dirender server sebagai satu baris (tanpa
// perubahan layout). Kursor di atas logo atau fokus keyboard menghentikannya (fokus juga menggeser logo
// itu ke layar). Reduced motion: grid statis lewat CSS.
export function ClientLogos({ clients }: { clients: PublicClient[] }) {
  return (
    <VelocityMarquee className="border-t border-l border-border" listClassName="motion-reduce:w-full" autoSpeed={MARQUEE_AUTO_SPEED}>
      <Reveal
        as="ul"
        data-reveal-children="pop"
        className="flex motion-reduce:grid motion-reduce:grid-cols-2 sm:motion-reduce:grid-cols-4 lg:motion-reduce:grid-cols-6"
      >
        {clients.map((client, index) => {
          const content = client.logo ? (
            <span className="relative block h-12 w-full">
              {/* Alt logo = nama klien kalau alt di media library kosong. */}
              <PublicImage
                image={{ ...client.logo, alt: client.logo.alt || client.name }}
                sizes={LOGO_SIZES}
                fit="contain"
                grayscale
              />
            </span>
          ) : (
            <span className="font-mono text-label uppercase tracking-[0.08em] whitespace-nowrap text-fg-strong">{client.name}</span>
          );
          const box =
            "flex h-28 items-center justify-center border-r border-b border-border px-6 opacity-60 transition-opacity duration-150 ease-standard";
          return (
            <li key={`${client.name}-${index}`} className="w-56 shrink-0 motion-reduce:w-auto">
              {client.url ? (
                <a
                  href={client.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${box} outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}
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
      </Reveal>
    </VelocityMarquee>
  );
}
