import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getPublicEnv } from "@/lib/env";
import type {
  ApiSuccess,
  PaginationMeta,
  PublicCatalogMeta,
  PublicCategory,
  PublicNav,
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
  category: (slug: string) => `category:${slug}`,
  training: (slug: string) => `training:${slug}`,
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

export type { PaginationMeta };
