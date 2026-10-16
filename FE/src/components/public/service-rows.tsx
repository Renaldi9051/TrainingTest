import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { LineDraw } from "@/components/motion/reveal-parts";
import { IndexNumber } from "@/components/decor/index-number";
import type { PublicServiceCard } from "@/lib/api/types";
import { PublicImage } from "./public-image";

// Baris layanan bernomor (DESIGN 7): nomor besar + judul di kiri, ringkasan di kanan, dipisah
// garis. Masuk: garis digambar, baris dari kiri (stagger 40 ms). Hover: teks bergeser 8 px dan
// (desktop, kalau layanan punya gambar) gambarnya mengikuti kursor di dalam baris (PointerEffects).
// Gambar itu hiasan (aria-hidden) dan tidak dimuat di perangkat tanpa hover (display: none).
// headingLevel: h2 kalau langsung di bawah h1 halaman (/layanan), h3 di bawah judul section.
// decor: nomor raksasa mono (IndexNumber, DESIGN.md 8.5); mati = nomor kecil abu.
export function ServiceRows({
  services,
  headingLevel = "h3",
  decor = true,
}: {
  services: PublicServiceCard[];
  headingLevel?: "h2" | "h3";
  decor?: boolean;
}) {
  const Heading = headingLevel;
  return (
    <Reveal>
      <LineDraw />
      <ol data-reveal-children="item">
        {services.map((service, index) => (
          <li key={service.slug} data-cursor-image={service.image ? "" : undefined} className="group relative border-b border-border">
            {service.image ? (
              <div
                aria-hidden
                data-cursor-follow=""
                className="pointer-events-none absolute top-0 left-0 z-10 hidden aspect-[4/3] w-60 overflow-hidden bg-bg-muted opacity-0 transition-[opacity,transform] duration-300 ease-standard data-active:opacity-100 pointer-fine:motion-safe:block"
              >
                <PublicImage image={service.image} sizes="240px" />
              </div>
            ) : null}
            <div className="grid gap-3 py-8 transition-transform duration-150 ease-standard md:grid-cols-12 md:gap-6 md:py-10 motion-safe:group-hover:translate-x-2 motion-safe:group-focus-within:translate-x-2">
              {decor ? (
                <IndexNumber position={index + 1} className="md:col-span-2" />
              ) : (
                <span aria-hidden className="font-mono text-[28px] leading-none text-fg-muted md:col-span-2 md:text-[40px]">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
              <div className="md:col-span-4">
                <Heading className="text-[20px] leading-[1.25] font-medium text-fg-strong md:text-[24px]">
                  {/* Seluruh baris bisa diklik lewat pseudo-element, tapi tetap satu link untuk pembaca layar. */}
                  <Link
                    href={`/layanan/${service.slug}`}
                    className="underline-offset-4 outline-none after:absolute after:inset-0 group-hover:underline focus-visible:underline focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-2"
                  >
                    {service.title}
                  </Link>
                </Heading>
                {/* Tagline (opsional, CMS): label mono di bawah judul. */}
                {service.tagline ? (
                  <p className="mt-2.5 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{service.tagline}</p>
                ) : null}
              </div>
              <p className="max-w-[65ch] text-body text-fg-muted md:col-span-5">{service.summary}</p>
              <ArrowRightIcon
                aria-hidden
                strokeWidth={1.5}
                className="hidden size-6 justify-self-end text-fg-strong transition-colors duration-150 ease-standard group-hover:text-primary group-focus-within:text-primary md:col-span-1 md:block"
              />
            </div>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
