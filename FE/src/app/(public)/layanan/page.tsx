import type { Metadata } from "next";
import Link from "next/link";
import { PlusMarker } from "@/components/decor/plus-marker";
import { Reveal } from "@/components/motion/reveal";
import { PageHero } from "@/components/public/page-hero";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceRows } from "@/components/public/service-rows";
import { ButtonArrow, buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getServices, getSettings } from "@/lib/api/public";
import type { ServicesProcess } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Layanan",
  alternates: { canonical: "/layanan" },
};

// Label UI bawaan; diganti isi Pengaturan > Kepala halaman kalau diisi.
const DEFAULT_TITLE = "Layanan";

export default async function ServicesPage() {
  const [services, settings] = await Promise.all([getServices(), getSettings()]);
  const header = settings.pageHeaders.layanan;
  return (
    <>
      <PageHero
        crumbs={[{ label: header.heading || DEFAULT_TITLE }]}
        eyebrow={header.eyebrow || undefined}
        title={header.heading || DEFAULT_TITLE}
        lead={header.lead || null}
        outline="Layanan"
      />
      <Container className="pt-12 pb-20 md:pt-16 md:pb-32">
        {services.length > 0 ? (
          // Langsung di bawah h1 halaman: judul baris h2.
          <ServiceRows services={services} headingLevel="h2" />
        ) : (
          <p className="border-t border-border pt-8 text-body text-fg-muted">Daftar layanan sedang disiapkan.</p>
        )}
      </Container>
      <ProcessSection process={settings.servicesProcess} />
      <section aria-labelledby="layanan-cta" className="border-t border-border py-20 md:py-24">
        <Container className="flex flex-wrap items-center justify-between gap-6">
          <h2 id="layanan-cta" className="max-w-[18ch] text-h2 text-fg-strong">
            Belum yakin format mana yang cocok?
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/kontak" className={cn(buttonVariants({ variant: "primary", size: "lg" }), "gap-2")}>
              Konsultasi
              <ButtonArrow />
            </Link>
            <Link href="/pelatihan" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              Lihat katalog pelatihan
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

// Alur kerja sama (Pengaturan > Alur kerja sama). Tanpa langkah: tidak tampil.
function ProcessSection({ process }: { process: ServicesProcess }) {
  if (process.steps.length === 0) return null;
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    <section aria-labelledby="alur-kerja-sama" className="bg-bg-subtle py-20 md:py-28">
      <Container className="space-y-12 md:space-y-14">
        <SectionHeading eyebrow={process.eyebrow} title={process.heading || undefined} id={process.heading ? "alur-kerja-sama" : undefined} />
        {!process.heading ? (
          <h2 id="alur-kerja-sama" className="sr-only">
            Alur kerja sama
          </h2>
        ) : null}
        <Reveal as="ol" data-reveal-children="card" className="grid gap-10 border-t border-border-strong sm:grid-cols-2 lg:grid-cols-4">
          {process.steps.map((step, index) => (
            <li key={index} className="relative pt-7 pr-6">
              <PlusMarker className="-top-1.5 -left-1.5" />
              {index === process.steps.length - 1 ? <PlusMarker className="-top-1.5 -right-1.5" /> : null}
              <p className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong">Langkah {pad(index + 1)}</p>
              <h3 className="mt-4 mb-2 text-h3 text-fg-strong">{step.title}</h3>
              {step.description ? <p className="text-body text-fg-muted">{step.description}</p> : null}
            </li>
          ))}
        </Reveal>
      </Container>
    </section>
  );
}
