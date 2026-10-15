import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { ReadingProgress } from "@/components/motion/reading-progress";
import { PageBlocks } from "@/components/public/page-blocks";
import { PageHero } from "@/components/public/page-hero";
import { PreviewBanner } from "@/components/public/preview-banner";
import { getPage, getPageRefs, getRedirect, Tag } from "@/lib/api/public";
import { getPagePreview } from "@/lib/api/preview";
import type { PublicPage } from "@/lib/api/types";
import { pageMetadata } from "@/lib/page-metadata";
import { followRedirect } from "@/lib/public-redirect";

// Halaman statis (Syarat & Ketentuan, Kebijakan Privasi, dst.). Slug yang belum di-prerender
// (mis. halaman baru setelah build) dirender saat diminta lalu di-cache; ensureStatic menunggu
// render lengkap supaya slug yang tidak ada mendapat HTTP 404 sungguhan.
export const ensureStatic = "navigation";
export const instant = false;

// Slug yang tidak pernah valid dipakai kalau BE belum bisa dihubungi saat build (wajib >= 1 param).
const BUILD_PLACEHOLDER = "__placeholder";

export async function generateStaticParams() {
  try {
    const pages = await getPageRefs();
    if (pages.length > 0) return pages.map((page) => ({ slug: page.slug }));
  } catch {
    // BE tidak terjangkau saat build: halaman dibuat saat diminta pertama kali.
  }
  return [{ slug: BUILD_PLACEHOLDER }];
}

async function loadPage(slug: string): Promise<{ page: PublicPage; preview: boolean } | null> {
  if (slug === BUILD_PLACEHOLDER) return null;
  if ((await draftMode()).isEnabled) {
    const preview = await getPagePreview(slug);
    if (preview?.kind === "STANDARD") return { page: preview, preview: true };
  }
  const page = await getPage(slug);
  // Halaman profil punya route sendiri (/profil).
  return page?.kind === "STANDARD" ? { page, preview: false } : null;
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadPage(slug);
  if (!loaded) return { title: "Halaman tidak ditemukan" };
  return pageMetadata({ title: loaded.page.title, path: `/${loaded.page.slug}`, seo: loaded.page.seo, preview: loaded.preview });
}

export default async function StaticPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  const loaded = await loadPage(slug);
  if (!loaded) {
    // Slug lama yang pernah tayang: ikuti tabel Redirect.
    const target = slug === BUILD_PLACEHOLDER ? null : await getRedirect(`/${slug}`, Tag.page(slug));
    if (target) followRedirect(target);
    notFound();
  }
  const { page, preview } = loaded;
  return (
    <>
      {preview ? <PreviewBanner path={`/${page.slug}`} /> : null}
      <ReadingProgress />
      <PageHero crumbs={[{ label: page.title }]} title={page.title} />
      <PageBlocks blocks={page.blocks} />
    </>
  );
}
