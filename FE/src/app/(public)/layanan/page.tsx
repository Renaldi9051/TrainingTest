import type { Metadata } from "next";
import { PageHero } from "@/components/public/page-hero";
import { ServiceRows } from "@/components/public/service-rows";
import { Container } from "@/components/ui/container";
import { getServices } from "@/lib/api/public";

export const metadata: Metadata = {
  title: "Layanan",
  alternates: { canonical: "/layanan" },
};

export default async function ServicesPage() {
  const services = await getServices();
  return (
    <>
      <PageHero crumbs={[{ label: "Layanan" }]} title="Layanan" outline="Layanan" />
      <Container className="pt-12 pb-20 md:pt-16 md:pb-32">
        {services.length > 0 ? (
          // Langsung di bawah h1 halaman: judul baris h2.
          <ServiceRows services={services} headingLevel="h2" />
        ) : (
          <p className="border-t border-border pt-8 text-body text-fg-muted">Daftar layanan sedang disiapkan.</p>
        )}
      </Container>
    </>
  );
}
