import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { InquiriesList } from "./inquiries-list";

export const metadata: Metadata = { title: "Inquiry" };

export default function InquiriesPage() {
  return (
    <>
      <PageHeader
        title="Inquiry"
        description="Pesan dari form detail pelatihan dan halaman kontak. Data pribadi: hanya untuk menindaklanjuti permintaan."
      />
      <InquiriesList />
    </>
  );
}
