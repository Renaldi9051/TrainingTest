import type { Metadata } from "next";
import { EditArticle } from "./edit-article";

// Halaman admin selalu dirender per request (sesi); tidak perlu validasi navigasi instan.
export const instant = false;

export const metadata: Metadata = { title: "Ubah artikel" };

export default async function EditArticlePage({ params }: PageProps<"/admin/articles/[id]">) {
  const { id } = await params;
  return <EditArticle id={id} />;
}
