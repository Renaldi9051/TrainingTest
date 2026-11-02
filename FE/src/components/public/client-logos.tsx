import type { PublicClient } from "@/lib/api/types";
import { Reveal } from "@/components/motion/reveal";
import { MARQUEE_AUTO_SPEED } from "@/components/motion/marquee-plan";
import { VelocityMarquee } from "@/components/motion/velocity-marquee";
import { PublicImage } from "./public-image";

// Wadah logo persegi 112 px (size-28).
const LOGO_SIZES = "112px";

const NAME = "text-center font-mono text-label uppercase tracking-[0.08em] text-balance";

// Logo klien berwarna dalam wadah persegi, tanpa kotak grid, dengan nama instansi di bawahnya (keputusan
// pemilik 2 Nov 2026, menggantikan grayscale + opacity 60% di DESIGN 2). Logo sebaiknya berlatar transparan. Tanpa logo: nama klien saja sebagai wordmark mono.
// Masuk: logo membesar dari 0,92 bertahap. Gerak: satu baris yang berjalan sendiri pelan,
// dipercepat/dibalik oleh scroll (VelocityMarquee), dirender server sebagai satu baris (tanpa perubahan
// layout). Kursor di atas logo atau fokus keyboard menghentikannya (fokus juga menggeser logo itu ke
// layar). Reduced motion: grid statis lewat CSS.
export function ClientLogos({ clients }: { clients: PublicClient[] }) {
  return (
    <VelocityMarquee listClassName="motion-reduce:w-full" autoSpeed={MARQUEE_AUTO_SPEED}>
      <Reveal
        as="ul"
        data-reveal-children="pop"
        className="flex motion-reduce:grid motion-reduce:grid-cols-2 sm:motion-reduce:grid-cols-4 lg:motion-reduce:grid-cols-6"
      >
        {clients.map((client, index) => {
          const content = client.logo ? (
            <>
              <span className="relative block size-28">
                {/* Alt kosong: nama instansi sudah tertulis di bawah logo. Tanpa blok placeholder --bg-muted:
                    di sisa ruang object-contain blok itu tampak sebagai kotak di belakang logo. */}
                <PublicImage
                  image={{ ...client.logo, alt: "" }}
                  sizes={LOGO_SIZES}
                  fit="contain"
                  className="bg-transparent"
                />
              </span>
              <span className={`${NAME} text-fg-muted`}>{client.name}</span>
            </>
          ) : (
            <span className={`${NAME} text-fg-strong`}>{client.name}</span>
          );
          // Rata atas: logo sejajar walau nama di bawahnya 1 atau 2 baris.
          const box = "flex h-full flex-col items-center gap-4 px-6 py-6";
          return (
            <li key={`${client.name}-${index}`} className="w-60 shrink-0 motion-reduce:w-auto">
              {client.url ? (
                <a
                  href={client.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${box} outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus`}
                >
                  {content}
                  <span className="sr-only"> (tab baru)</span>
                </a>
              ) : (
                <div className={box}>{content}</div>
              )}
            </li>
          );
        })}
      </Reveal>
    </VelocityMarquee>
  );
}
