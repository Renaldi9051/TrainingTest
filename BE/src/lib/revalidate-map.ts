import { AsyncLocalStorage } from "node:async_hooks";
import { revalidateTags, RevalidateTag, tags } from "@/lib/revalidate";

// Satu-satunya peta entitas -> tag cache FE. Service memanggil revalidateEntity dengan event
// entitas yang berubah, bukan menyusun daftar tag sendiri, supaya halaman yang ikut menampilkan
// data itu tidak terlupa. Beranda (`home`) menampilkan pelatihan, jadwal, kategori, layanan,
// klien, dan testimoni, jadi semua entitas itu ikut me-revalidate `home`.
// Tabel konvensi tag: AGENTS.md.

type Slugs = readonly (string | null | undefined)[];

export type RevalidateEvent =
  | { entity: "Settings" }
  | { entity: "Nav" }
  | { entity: "Media" }
  // Slug lama + baru kalau slug berubah.
  | { entity: "Category"; slugs: Slugs }
  | { entity: "CategoryOrder" }
  | { entity: "Training"; slugs: Slugs }
  // Slug pelatihan pemilik jadwal (lama + baru kalau jadwal pindah pelatihan).
  | { entity: "Schedule"; trainingSlugs: Slugs }
  // Tanggal WIB berganti: status sesi (SELESAI) dan jadwal terdekat berubah.
  | { entity: "DayChange" }
  | { entity: "HomeSection" }
  | { entity: "Page"; slugs: Slugs }
  | { entity: "Service"; slugs: Slugs }
  | { entity: "Client" }
  | { entity: "Testimonial" }
  | { entity: "PortfolioItem" }
  | { entity: "MarketingContact" }
  | { entity: "MediaPartner" };

export type RevalidateEntityName = RevalidateEvent["entity"];

const slugTags = (slugs: Slugs, toTag: (slug: string) => string) =>
  slugs.map((slug) => (slug ? toTag(slug) : null));

export function tagsForEvent(event: RevalidateEvent): string[] {
  switch (event.entity) {
    case "Settings":
      return [RevalidateTag.SETTINGS];
    case "Nav":
      return [RevalidateTag.NAV];
    case "Media":
      return [RevalidateTag.MEDIA];
    case "Category":
      return tags(
        RevalidateTag.CATEGORIES,
        RevalidateTag.TRAININGS,
        RevalidateTag.HOME,
        ...slugTags(event.slugs, RevalidateTag.category),
      );
    case "CategoryOrder":
      return [RevalidateTag.CATEGORIES, RevalidateTag.HOME];
    case "Training":
      return tags(
        RevalidateTag.TRAININGS,
        RevalidateTag.CATEGORIES,
        RevalidateTag.SCHEDULES,
        RevalidateTag.HOME,
        ...slugTags(event.slugs, RevalidateTag.training),
      );
    case "Schedule":
      return tags(
        RevalidateTag.SCHEDULES,
        RevalidateTag.HOME,
        ...slugTags(event.trainingSlugs, RevalidateTag.training),
      );
    case "DayChange":
      return [RevalidateTag.SCHEDULES, RevalidateTag.TRAININGS, RevalidateTag.HOME];
    case "HomeSection":
      return [RevalidateTag.HOME];
    case "Page":
      return tags(RevalidateTag.PAGES, ...slugTags(event.slugs, RevalidateTag.page));
    // Layanan tampil di beranda dan di blok SERVICES halaman (semua fetch halaman bertag `pages`).
    case "Service":
      return tags(
        RevalidateTag.SERVICES,
        RevalidateTag.HOME,
        RevalidateTag.PAGES,
        ...slugTags(event.slugs, RevalidateTag.service),
      );
    case "Client":
      return [RevalidateTag.CLIENTS, RevalidateTag.HOME];
    case "Testimonial":
      return [RevalidateTag.TESTIMONIALS, RevalidateTag.HOME];
    case "PortfolioItem":
      return [RevalidateTag.PORTFOLIO];
    case "MarketingContact":
      return [RevalidateTag.MARKETING];
    case "MediaPartner":
      return [RevalidateTag.MEDIA_PARTNERS];
  }
}

// Tag yang dikumpulkan selama satu request admin (lihat withRevalidateBatch).
const batchStorage = new AsyncLocalStorage<Set<string>>();

// Revalidate tag untuk satu atau beberapa event sekaligus, tanpa duplikat. Di dalam
// withRevalidateBatch tag hanya dikumpulkan (dikirim sekali di akhir request) dan hasilnya true.
// Di luar batch (scheduler, seed) dikirim langsung; false = ada batch ke FE yang gagal.
export async function revalidateEntity(events: RevalidateEvent | readonly RevalidateEvent[]): Promise<boolean> {
  const list: readonly RevalidateEvent[] = Array.isArray(events) ? events : [events as RevalidateEvent];
  const collected = tags(...list.flatMap(tagsForEvent));
  if (collected.length === 0) return true;

  const batch = batchStorage.getStore();
  if (batch) {
    for (const tag of collected) batch.add(tag);
    return true;
  }
  return revalidateTags(collected);
}

// Jalankan fn dengan satu antrean tag; semua revalidateEntity di dalamnya digabung jadi satu
// panggilan ke FE setelah fn selesai. Tetap dikirim walau fn melempar error, karena mutasi yang
// sudah commit sebelum error tetap harus tampil. Batch bersarang memakai antrean terluar.
export async function withRevalidateBatch<T>(fn: () => Promise<T>): Promise<T> {
  if (batchStorage.getStore()) return fn();
  const batch = new Set<string>();
  try {
    return await batchStorage.run(batch, fn);
  } finally {
    if (batch.size > 0) await revalidateTags([...batch]);
  }
}
