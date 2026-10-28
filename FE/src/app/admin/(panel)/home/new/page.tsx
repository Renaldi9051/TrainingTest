import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { ADDABLE_HOME_SECTION_TYPES, HOME_SECTION_LABELS } from "@/lib/home-sections";
import { NewSectionGuard } from "./new-section-guard";

// Halaman admin selalu dirender per request (sesi); tidak perlu validasi navigasi instan.
export const instant = false;

export const metadata: Metadata = { title: "Tambah section" };

export default async function NewSectionPage({ searchParams }: PageProps<"/admin/home/new">) {
  const raw = (await searchParams).type;
  const type = ADDABLE_HOME_SECTION_TYPES.find((value) => value === raw);
  if (!type) notFound();
  return (
    <>
      <PageHeader title={`Tambah section ${HOME_SECTION_LABELS[type]}`} />
      <NewSectionGuard type={type} />
    </>
  );
}
