import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ServiceForm } from "../service-form";

export const metadata: Metadata = { title: "Tambah layanan" };

export default function NewServicePage() {
  return (
    <>
      <PageHeader title="Tambah layanan" />
      <ServiceForm service={null} />
    </>
  );
}
