import type { Metadata } from "next";
import { PageIntro } from "@/components/public/page-intro";
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
      <PageIntro title="Layanan" />
      <Container className="pb-20 md:pb-32">
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
