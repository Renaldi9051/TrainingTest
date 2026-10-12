import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getPublicEnv } from "@/lib/env";
import type {
  ApiSuccess,
  PaginationMeta,
  PublicCatalogMeta,
  PublicCategory,
  PublicHome,
  PublicMediaPartner,
  PublicNav,
  PublicPage,
  PublicPageRef,
  PublicPortfolioItem,
  PublicServiceCard,
  PublicServiceDetail,
  PublicSchedule,
  PublicScheduleMeta,
  PublicSettings,
  PublicTrainingCard,
  PublicTrainingDetail,
} from "./types";

// Data halaman publik dari BE, di-cache dengan `use cache` + tag. BE memanggil
// POST /api/revalidate dengan tag yang sama setelah mutasi (konvensi tag: AGENTS.md).
export const Tag = {
  SETTINGS: "settings",
  NAV: "nav",
  CATEGORIES: "categories",
  TRAININGS: "trainings",
  SCHEDULES: "schedules",
  MEDIA: "media",
  HOME: "home",
  PAGES: "pages",
  SERVICES: "services",
  PORTFOLIO: "portfolio",
  MEDIA_PARTNERS: "media-partners",
  category: (slug: string) => `category:${slug}`,
  training: (slug: string) => `training:${slug}`,
  page: (slug: string) => `page:${slug}`,
  service: (slug: string) => `service:${slug}`,
} as const;

class PublicApiError extends Error {
  constructor(
    readonly status: number,
    path: string,
  ) {
    super(`BE publik ${path} gagal (HTTP ${status}).`);
    this.name = "PublicApiError";
  }
}

// null = 404 (konten tidak ada). Error lain dilempar supaya tampil sebagai halaman error.
async function getJson<T, M = undefined>(path: string): Promise<ApiSuccess<T, M> | null> {
  const response = await fetch(`${getPublicEnv().BE_INTERNAL_URL}/api/public${path}`, {
    headers: { Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new PublicApiError(response.status, path);
  return (await response.json()) as ApiSuccess<T, M>;
}

async function getRequired<T>(path: string): Promise<T> {
  const body = await getJson<T>(path);
  if (!body) throw new PublicApiError(404, path);
  return body.data;
}

export async function getSettings(): Promise<PublicSettings> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.SETTINGS, Tag.MEDIA);
  return getRequired<PublicSettings>("/settings");
}

export async function getNav(): Promise<PublicNav> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.NAV);
  return getRequired<PublicNav>("/nav");
}

export async function getCategories(): Promise<PublicCategory[]> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.CATEGORIES, Tag.TRAININGS);
  return getRequired<PublicCategory[]>("/categories");
}

export async function getCategory(slug: string): Promise<PublicCategory | null> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.CATEGORIES, Tag.category(slug), Tag.TRAININGS);
  return (await getJson<PublicCategory>(`/categories/${encodeURIComponent(slug)}`))?.data ?? null;
}

export type CatalogParams = {
  q?: string;
  kategori?: string[];
  metode?: string;
  tipe?: string;
  urut?: string;
  hal?: number;
  per?: number;
};

export function catalogSearchParams(params: CatalogParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.kategori && params.kategori.length > 0) search.set("kategori", params.kategori.join(","));
  if (params.metode) search.set("metode", params.metode);
  if (params.tipe) search.set("tipe", params.tipe);
  if (params.urut) search.set("urut", params.urut);
  if (params.hal && params.hal > 1) search.set("hal", String(params.hal));
  if (params.per) search.set("per", String(params.per));
  return search;
}

export type Catalog = { items: PublicTrainingCard[]; meta: PublicCatalogMeta };

// Kunci cache = string query yang sudah dinormalisasi (urutan parameter tetap).
async function getCatalogByQuery(query: string): Promise<Catalog> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.TRAININGS, Tag.CATEGORIES, Tag.MEDIA);
  const body = await getJson<PublicTrainingCard[], PublicCatalogMeta>(`/trainings?${query}`);
  if (!body?.meta) throw new PublicApiError(404, "/trainings");
  return { items: body.data, meta: body.meta };
}

export function getCatalog(params: CatalogParams): Promise<Catalog> {
  return getCatalogByQuery(catalogSearchParams(params).toString());
}

export async function getTraining(slug: string): Promise<PublicTrainingDetail | null> {
  "use cache";
  cacheLife("content");
  // Detail juga memuat nama kategori, jadwal, pelatihan terkait, dan default global
  // (fasilitas, FAQ umum, catatan in-house dari Pengaturan), jadi ikut tag-tag itu.
  cacheTag(Tag.training(slug), Tag.TRAININGS, Tag.CATEGORIES, Tag.SCHEDULES, Tag.SETTINGS, Tag.MEDIA);
  return (await getJson<PublicTrainingDetail>(`/trainings/${encodeURIComponent(slug)}`))?.data ?? null;
}

export async function getTrainingSlugs(limit: number): Promise<string[]> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.TRAININGS);
  return getRequired<string[]>(`/training-slugs?limit=${limit}`);
}

export type ScheduleParams = { bulan?: string; kota?: string; kategori?: string; hal?: number };

export type ScheduleList = { items: PublicSchedule[]; meta: PublicScheduleMeta };

async function getSchedulesByQuery(query: string): Promise<ScheduleList> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.SCHEDULES, Tag.TRAININGS, Tag.CATEGORIES);
  const body = await getJson<PublicSchedule[], PublicScheduleMeta>(`/schedules?${query}`);
  if (!body?.meta) throw new PublicApiError(404, "/schedules");
  return { items: body.data, meta: body.meta };
}

export function getSchedules(params: ScheduleParams): Promise<ScheduleList> {
  const search = new URLSearchParams();
  if (params.bulan) search.set("bulan", params.bulan);
  if (params.kota) search.set("kota", params.kota);
  if (params.kategori) search.set("kategori", params.kategori);
  if (params.hal && params.hal > 1) search.set("hal", String(params.hal));
  return getSchedulesByQuery(search.toString());
}

// ===== Beranda, halaman, layanan, portofolio, media partner (Fase 3) =====

export async function getHome(): Promise<PublicHome> {
  "use cache";
  cacheLife("content");
  // BE me-revalidate `home` saat section beranda ATAU data yang tampil di sana berubah.
  cacheTag(Tag.HOME, Tag.MEDIA);
  return getRequired<PublicHome>("/home");
}

export async function getPage(slug: string): Promise<PublicPage | null> {
  "use cache";
  cacheLife("content");
  // `pages` juga di-revalidate saat layanan berubah (blok SERVICES).
  cacheTag(Tag.page(slug), Tag.PAGES, Tag.MEDIA);
  return (await getJson<PublicPage>(`/pages/${encodeURIComponent(slug)}`))?.data ?? null;
}

// Halaman statis yang tayang (tanpa halaman profil), untuk generateStaticParams /[slug].
export async function getPageRefs(): Promise<PublicPageRef[]> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.PAGES);
  return getRequired<PublicPageRef[]>("/pages");
}

export async function getServices(): Promise<PublicServiceCard[]> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.SERVICES, Tag.MEDIA);
  return getRequired<PublicServiceCard[]>("/services");
}

export async function getService(slug: string): Promise<PublicServiceDetail | null> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.service(slug), Tag.SERVICES, Tag.MEDIA);
  return (await getJson<PublicServiceDetail>(`/services/${encodeURIComponent(slug)}`))?.data ?? null;
}

export async function getPortfolio(): Promise<PublicPortfolioItem[]> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.PORTFOLIO, Tag.MEDIA);
  return getRequired<PublicPortfolioItem[]>("/portfolio");
}

export async function getMediaPartners(): Promise<PublicMediaPartner[]> {
  "use cache";
  cacheLife("content");
  cacheTag(Tag.MEDIA_PARTNERS);
  return getRequired<PublicMediaPartner[]>("/media-partners");
}

export type PublicRedirect = { to: string; permanent: boolean };

// Redirect dari tabel Redirect untuk slug yang tidak ditemukan. Di-cache dengan tag slug lama
// (`service:<slug>` / `page:<slug>`), yang di-revalidate BE saat slug itu berubah.
export async function getRedirect(path: string, tag: string): Promise<PublicRedirect | null> {
  "use cache";
  cacheLife("content");
  cacheTag(tag);
  return (await getJson<PublicRedirect>(`/redirects?path=${encodeURIComponent(path)}`))?.data ?? null;
}

export type { PaginationMeta };
