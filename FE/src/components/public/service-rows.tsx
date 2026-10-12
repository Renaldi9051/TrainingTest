import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import type { PublicServiceCard } from "@/lib/api/types";

// Baris layanan bernomor (DESIGN 7): nomor besar + judul di kiri, ringkasan di kanan, dipisah
// garis. Hover: teks bergeser 8 px (gambar mengikuti kursor menyusul di Fase 4).
// headingLevel: h2 kalau langsung di bawah h1 halaman (/layanan), h3 di bawah judul section.
export function ServiceRows({ services, headingLevel = "h3" }: { services: PublicServiceCard[]; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <ol className="border-t border-border">
      {services.map((service, index) => (
        <li key={service.slug} className="group relative border-b border-border">
          <div className="grid gap-3 py-8 transition-transform duration-150 ease-standard md:grid-cols-12 md:gap-6 md:py-10 motion-safe:group-hover:translate-x-2 motion-safe:group-focus-within:translate-x-2">
            <span aria-hidden className="font-mono text-[28px] leading-none text-fg-muted md:col-span-2 md:text-[40px]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <Heading className="text-[20px] leading-[1.25] font-medium text-fg-strong md:col-span-4 md:text-[24px]">
              {/* Seluruh baris bisa diklik lewat pseudo-element, tapi tetap satu link untuk pembaca layar. */}
              <Link
                href={`/layanan/${service.slug}`}
                className="underline-offset-4 outline-none after:absolute after:inset-0 group-hover:underline focus-visible:underline focus-visible:after:ring-2 focus-visible:after:ring-fg-strong focus-visible:after:ring-offset-2"
              >
                {service.title}
              </Link>
            </Heading>
            <p className="max-w-[65ch] text-body text-fg-muted md:col-span-5">{service.summary}</p>
            <ArrowRightIcon
              aria-hidden
              strokeWidth={1.5}
              className="hidden size-6 justify-self-end text-fg-strong md:col-span-1 md:block"
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
