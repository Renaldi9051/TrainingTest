import type { Metadata } from "next";
import { draftMode } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ActiveIndicator } from "@/components/motion/active-indicator";
import { ReadingProgress } from "@/components/motion/reading-progress";
import { ScrollSpyToc } from "@/components/motion/scroll-spy-toc";
import { PageBlocks } from "@/components/public/page-blocks";
import { PageHero } from "@/components/public/page-hero";
import { PreviewBanner } from "@/components/public/preview-banner";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getPage, getPageRefs, getRedirect, Tag } from "@/lib/api/public";
import { getPagePreview } from "@/lib/api/preview";
import type { PublicPage } from "@/lib/api/types";
import { pageMetadata } from "@/lib/page-metadata";
import { followRedirect } from "@/lib/public-redirect";
import { tocEntries, updatedLabel } from "@/lib/static-page-plan";
import { cn } from "@/lib/utils";

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
  const refs = await getPageRefs();
  // Tab ke halaman statis lain (mockup "Halaman legal"): hanya kalau ada minimal 2 halaman.
  const tabs = refs.some((ref) => ref.slug === page.slug) ? refs : [...refs, { slug: page.slug, title: page.title }];
  const toc = tocEntries(page.blocks);
  return (
    <>
      {preview ? <PreviewBanner path={`/${page.slug}`} /> : null}
      <ReadingProgress />
      <PageHero
        crumbs={[{ label: page.title }]}
        title={page.title}
        aside={
          <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted md:text-right">
            Diperbarui / {updatedLabel(page.updatedAt)}
          </p>
        }
      >
        {tabs.length >= 2 ? (
          <nav aria-label="Halaman lain" className="mt-10 -mb-px overflow-x-auto">
            <ActiveIndicator variant="line">
              <ul className="flex w-max gap-6">
                {tabs.map((tab) => (
                  <li key={tab.slug}>
                    <Link
                      href={`/${tab.slug}`}
                      aria-current={tab.slug === page.slug ? "page" : undefined}
                      className="inline-flex h-11 items-center rounded-sm text-small whitespace-nowrap text-fg-muted outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong aria-[current=page]:text-fg-strong"
                    >
                      {tab.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </ActiveIndicator>
          </nav>
        ) : null}
      </PageHero>
      <Container className="grid grid-cols-1 gap-10 pt-12 pb-24 md:pt-14 md:pb-32 lg:grid-cols-12 lg:gap-6">
        {toc.length > 0 ? (
          <aside className="lg:col-span-3">
            <nav aria-label="Daftar isi" className="lg:sticky lg:top-24">
              <p className="mb-3 font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Daftar isi</p>
              <ScrollSpyToc sections={toc} />
            </nav>
          </aside>
        ) : null}
        <article className={cn("min-w-0", toc.length > 0 ? "lg:col-span-8 lg:col-start-5" : "lg:col-span-8 lg:col-start-3")}>
          <PageBlocks blocks={page.blocks} />
          <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border border-border p-6">
            <p className="text-body text-fg-strong">Ada pertanyaan tentang halaman ini?</p>
            <Link href="/kontak" className={buttonVariants({ variant: "secondary" })}>
              Hubungi kami
            </Link>
          </div>
        </article>
      </Container>
    </>
  );
}
