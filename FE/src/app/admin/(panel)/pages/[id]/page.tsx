import type { Metadata } from "next";
import { EditPage } from "./edit-page";

// Halaman admin selalu dirender per request (sesi); tidak perlu validasi navigasi instan.
export const instant = false;

export const metadata: Metadata = { title: "Ubah halaman" };

export default async function EditPagePage({ params }: PageProps<"/admin/pages/[id]">) {
  const { id } = await params;
  return <EditPage id={id} />;
}
