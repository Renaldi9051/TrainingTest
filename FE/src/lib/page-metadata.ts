import type { Metadata } from "next";
import type { PublicImage } from "@/lib/api/types";

type PageMetadataInput = {
  // Judul konten (dipakai kalau judul SEO kosong).
  title: string;
  path: string;
  seo?: { title: string; description: string; ogImage: PublicImage | null };
  // Deskripsi cadangan kalau deskripsi SEO kosong (mis. ringkasan layanan).
  fallbackDescription?: string | null;
  // Gambar cadangan untuk OG.
  fallbackImage?: PublicImage | null;
  preview?: boolean;
};

// Metadata dasar halaman publik dari field SEO, dengan cadangan judul/ringkasan konten. Judul
// memakai template & default situs dari layout publik (pengaturan SEO default).
export function pageMetadata({ title, path, seo, fallbackDescription, fallbackImage, preview }: PageMetadataInput): Metadata {
  const metaTitle = seo?.title || title;
  const description = seo?.description || fallbackDescription || undefined;
  const image = seo?.ogImage ?? fallbackImage ?? null;
  return {
    title: metaTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: metaTitle,
      description,
      url: path,
      images: image ? [{ url: image.url, alt: image.alt ?? title }] : undefined,
    },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}
