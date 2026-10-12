import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import { PageBlocks } from "@/components/public/page-blocks";
import { PageIntro } from "@/components/public/page-intro";
import { PreviewBanner } from "@/components/public/preview-banner";
import { getPage } from "@/lib/api/public";
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
  const loaded = await loadProfile();
  if (!loaded) notFound();
  const { page, preview } = loaded;
  return (
    <>
      {preview ? <PreviewBanner path="/profil" /> : null}
      <PageIntro title={page.title} />
      <PageBlocks blocks={page.blocks} />
    </>
  );
}
