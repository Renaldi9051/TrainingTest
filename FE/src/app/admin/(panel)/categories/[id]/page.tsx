import type { Metadata } from "next";
import { EditCategory } from "./edit-category";

// Halaman admin selalu dirender per request (sesi); tidak perlu validasi navigasi instan.
export const instant = false;

export const metadata: Metadata = { title: "Ubah kategori" };

export default async function EditCategoryPage({ params }: PageProps<"/admin/categories/[id]">) {
  const { id } = await params;
  return <EditCategory id={id} />;
}
