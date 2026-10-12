import type { Metadata } from "next";
import { EditSection } from "./edit-section";

// Halaman admin selalu dirender per request (sesi); tidak perlu validasi navigasi instan.
export const instant = false;

export const metadata: Metadata = { title: "Ubah section" };

export default async function EditSectionPage({ params }: PageProps<"/admin/home/[id]">) {
  const { id } = await params;
  return <EditSection id={id} />;
}
