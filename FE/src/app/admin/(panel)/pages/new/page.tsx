import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { PageForm } from "../page-form";

export const metadata: Metadata = { title: "Tambah halaman" };

export default function NewPagePage() {
  return (
    <>
      <PageHeader title="Tambah halaman" />
      <PageForm page={null} />
    </>
  );
}
