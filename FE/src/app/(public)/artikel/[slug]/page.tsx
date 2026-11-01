import { ArrowUpRightIcon } from "lucide-react";
import type { Metadata } from "next";
import { draftMode } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Viewfinder } from "@/components/decor/viewfinder";
import { ReadingProgress } from "@/components/motion/reading-progress";
import { ArticleGrid } from "@/components/public/article-card";
import { JsonLd } from "@/components/public/json-ld";
import { Breadcrumb } from "@/components/public/page-hero";
import { PreviewBanner } from "@/components/public/preview-banner";
import { PublicImage } from "@/components/public/public-image";
import { RichTextHtml } from "@/components/public/rich-text-html";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getArticle, getArticleSlugs, getRedirect, getSettings, Tag } from "@/lib/api/public";
import { getArticlePreview } from "@/lib/api/preview";
import type { PublicArticleDetail } from "@/lib/api/types";
import { getPublicEnv } from "@/lib/env";
import { formatDateTime } from "@/lib/format";
import { followRedirect } from "@/lib/public-redirect";
import { articleJsonLd } from "@/lib/structured-data";

// Sama dengan detail pelatihan: halaman statis dari cache; slug yang belum di-prerender ditunggu
// sampai render lengkap, jadi slug yang tidak ada mendapat HTTP 404 sungguhan.
export const ensureStatic = "navigation";
export const instant = false;

// Slug yang tidak pernah valid dipakai kalau BE belum bisa dihubungi saat build (wajib >= 1 param).
const BUILD_PLACEHOLDER = "__placeholder";
const PRERENDER_LIMIT = 50;

export async function generateStaticParams() {
  try {
    const slugs = await getArticleSlugs(PRERENDER_LIMIT);
    if (slugs.length > 0) return slugs.map((slug) => ({ slug }));
  } catch {
    // BE tidak terjangkau saat build: halaman dibuat saat diminta pertama kali.
  }
  return [{ slug: BUILD_PLACEHOLDER }];
}

async function loadArticle(slug: string): Promise<{ article: PublicArticleDetail; preview: boolean } | null> {
  if (slug === BUILD_PLACEHOLDER) return null;
  // Draft mode hanya aktif setelah sesi admin dicek di /admin/preview.
  if ((await draftMode()).isEnabled) {
    const preview = await getArticlePreview(slug);
    if (preview) return { article: preview, preview: true };
  }
  const article = await getArticle(slug);
  return article ? { article, preview: false } : null;
}

export async function generateMetadata({ params }: PageProps<"/artikel/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await loadArticle(slug);
  if (!loaded) return { title: "Artikel tidak ditemukan" };
  const { article, preview } = loaded;
  const title = article.seo.title || article.title;
  const description = article.seo.description || article.excerpt || undefined;
  const image = article.seo.ogImage ?? article.cover;
  return {
    title,
    description,
    alternates: { canonical: `/artikel/${article.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/artikel/${article.slug}`,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      authors: [article.authorName],
      images: image ? [{ url: image.url, alt: image.alt ?? title }] : undefined,
    },
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}

// Detail artikel: kepala (kategori, h1, ringkasan, meta), foto sampul ber-Viewfinder kalau ada,
// isi rich text dengan lebar baca 65ch, info penulis/sumber di samping, lalu artikel lainnya.
export default async function ArticlePage({ params }: PageProps<"/artikel/[slug]">) {
  const { slug } = await params;
  const [loaded, settings] = await Promise.all([loadArticle(slug), getSettings()]);
  if (!loaded) {
    // Slug lama yang pernah tayang: ikuti tabel Redirect.
    const target = slug === BUILD_PLACEHOLDER ? null : await getRedirect(`/artikel/${slug}`, Tag.article(slug));
    if (target) followRedirect(target);
    notFound();
  }
  const { article, preview } = loaded;
  const siteUrl = getPublicEnv().NEXT_PUBLIC_SITE_URL;

  const facts = [
    { label: "Penulis", value: article.authorName },
    { label: "Terbit", value: `${formatDateTime(article.publishedAt)} WIB` },
  ];

  return (
    <>
      {preview ? <PreviewBanner path={`/artikel/${article.slug}`} /> : null}
      <ReadingProgress />
      <JsonLd data={articleJsonLd(article, siteUrl, settings.identity.name)} />

      <section className="pt-12 pb-10 md:pt-14 md:pb-12">
        <Container>
          <Breadcrumb
            crumbs={[
              { label: "Artikel", href: "/artikel" },
              ...(article.category
                ? [{ label: article.category.name, href: `/artikel?kategori=${article.category.slug}` }]
                : []),
              { label: article.title },
            ]}
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              {article.category ? (
                <Eyebrow data-page-enter="" className="mb-4">
                  {article.category.name}
                </Eyebrow>
              ) : null}
              <h1 data-page-enter="" className="max-w-[24ch] text-h1 text-fg-strong">
                {article.title}
              </h1>
            </div>
            {article.excerpt ? (
              <p data-page-enter="" className="max-w-[65ch] text-body-lg text-fg-muted lg:col-span-4">
                {article.excerpt}
              </p>
            ) : null}
          </div>
          <dl aria-label="Info artikel" className="mt-10 grid grid-cols-2 border-y border-border md:grid-cols-3">
            {facts.map((fact, index) => (
              <div key={fact.label} className={index > 0 ? "border-l border-border py-4 pl-4 md:pl-6" : "py-4 pr-4"}>
                <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{fact.label}</dt>
                <dd className="mt-1.5 text-[18px] leading-[1.4] font-medium text-fg-strong">{fact.value}</dd>
              </div>
            ))}
            {article.sourceName || article.sourceUrl ? (
              <div className="col-span-2 border-t border-border py-4 md:col-span-1 md:border-t-0 md:border-l md:pl-6">
                <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Sumber</dt>
                <dd className="mt-1.5 text-[18px] leading-[1.4] font-medium text-fg-strong">
                  {article.sourceUrl ? (
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-link underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                    >
                      {article.sourceName ?? new URL(article.sourceUrl).hostname}
                      <ArrowUpRightIcon className="size-4" strokeWidth={1.5} aria-hidden />
                      <span className="sr-only">(tab baru)</span>
                    </a>
                  ) : (
                    article.sourceName
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </Container>
      </section>

      {/* Tanpa sampul: tanpa blok gambar (bukan placeholder). */}
      {article.cover ? (
        <Container>
          <div className="relative aspect-4/3 overflow-hidden bg-bg-muted sm:aspect-video lg:aspect-auto lg:h-130">
            <PublicImage film image={article.cover} sizes="(min-width: 1280px) 1232px, 100vw" priority />
            <Viewfinder className="inset-4 md:inset-6" />
          </div>
        </Container>
      ) : null}

      <Container className="pt-12 pb-20 md:pt-16 md:pb-24">
        {article.bodyHtml ? (
          <RichTextHtml html={article.bodyHtml} className="mx-auto max-w-[65ch] text-body-lg" />
        ) : (
          <p className="mx-auto max-w-[65ch] text-body text-fg-muted">Isi artikel belum tersedia.</p>
        )}
      </Container>

      {article.related.length > 0 ? (
        <section aria-labelledby="related-title" className="border-t border-border py-20 md:py-24">
          <Container>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <Eyebrow className="mb-3">Baca juga</Eyebrow>
                <h2 id="related-title" className="text-h2 text-fg-strong">
                  Artikel lainnya
                </h2>
              </div>
              <Link href="/artikel" className={buttonVariants({ variant: "secondary" })}>
                Lihat semua artikel
              </Link>
            </div>
            <ArticleGrid articles={article.related} />
          </Container>
        </section>
      ) : null}
    </>
  );
}
