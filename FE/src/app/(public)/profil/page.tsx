import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/public/page-hero";
import { ProfileBlocks } from "@/components/public/profile-blocks";
import { PreviewBanner } from "@/components/public/preview-banner";
import { getCategories, getPage } from "@/lib/api/public";
import { getPagePreview } from "@/lib/api/preview";
import type { PublicPage } from "@/lib/api/types";
import { pageMetadata } from "@/lib/page-metadata";

// Halaman sistem PROFILE (slug terkunci "profil").
const PROFILE_SLUG = "profil";

async function loadProfile(): Promise<{ page: PublicPage; preview: boolean } | null> {
  if ((await draftMode()).isEnabled) {
    const preview = await getPagePreview(PROFILE_SLUG);
    if (preview?.kind === "PROFILE") return { page: preview, preview: true };
  }
  const page = await getPage(PROFILE_SLUG);
  return page?.kind === "PROFILE" ? { page, preview: false } : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const loaded = await loadProfile();
  if (!loaded) return { title: "Profil" };
  return pageMetadata({ title: loaded.page.title, path: "/profil", seo: loaded.page.seo, preview: loaded.preview });
}

export default async function ProfilePage() {
  const [loaded, categories] = await Promise.all([loadProfile(), getCategories()]);
  if (!loaded) notFound();
  const { page, preview } = loaded;
  // Chip "bidang unggulan" yang namanya sama dengan kategori jadi tautan ke landing kategori.
  const categoryHrefs = new Map(
    categories.map((category) => [category.name.trim().toLowerCase(), `/pelatihan/kategori/${category.slug}`]),
  );
  return (
    <>
      {preview ? <PreviewBanner path="/profil" /> : null}
      <PageHero crumbs={[{ label: page.title }]} title={page.title} outline="Profil" />
      <ProfileBlocks blocks={page.blocks} categoryHrefs={categoryHrefs} />
    </>
  );
}
