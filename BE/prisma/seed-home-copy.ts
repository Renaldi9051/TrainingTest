// Teks hero beranda disesuaikan dengan katalog (pemilik, 21 Okt 2026): katalog sekarang pelatihan
// korporat (keuangan, SDM, manajemen, K3, pertambangan, migas), bukan lagi drone dan industri kreatif.
// Sekali per versi. Field hanya diganti kalau isinya masih sama persis dengan teks seed lama, jadi teks
// yang sudah diubah admin tetap. Slide, CTA, dan pengaturan hero lain tidak disentuh.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { revalidateEntity } from "../src/lib/revalidate-map";
import { HOME_SECTION_CONTENT_SCHEMAS } from "../src/lib/validators/home-section";
import { AuditAction, writeAudit } from "../src/services/audit";
import { heroCopy } from "./seed-data/content";

export const HOME_COPY_KEY = "seed.homeCopy.version";
export const HOME_COPY_VERSION = "2026-10-21-hero-korporat";

// Teks seed lama (bertema drone) yang boleh diganti.
export const LEGACY_HERO_COPY = {
  rotatingWords: ["terbang", "berkarya", "berbisnis"],
  subheadline:
    "Pelatihan drone dan industri kreatif, dari pilot drone dan pemetaan udara sampai fotografi, videografi, dan desain, dipandu praktisi aktif.",
  searchPlaceholder: "Cari pelatihan, mis. pemetaan drone",
};

type HeroCopyField = keyof typeof LEGACY_HERO_COPY;
const FIELDS = Object.keys(LEGACY_HERO_COPY) as HeroCopyField[];

// Isi baru: field yang masih teks lama diganti; sisanya tetap. null = tidak ada yang berubah.
export function updatedHeroCopy(content: Record<string, unknown>): { content: Record<string, unknown>; changed: HeroCopyField[] } | null {
  const changed = FIELDS.filter((field) => JSON.stringify(content[field]) === JSON.stringify(LEGACY_HERO_COPY[field]));
  if (changed.length === 0) return null;
  return { content: { ...content, ...Object.fromEntries(changed.map((field) => [field, heroCopy[field]])) }, changed };
}

export async function seedHomeCopy(): Promise<{ changed: string[] } | "dilewati"> {
  const db = getDb();
  const done = await db.siteSetting.findUnique({ where: { key: HOME_COPY_KEY }, select: { value: true } });
  if (done?.value === HOME_COPY_VERSION) return "dilewati";

  const hero = await db.homeSection.findFirst({ where: { type: "HERO", deletedAt: null }, select: { id: true, content: true } });
  const content = hero && typeof hero.content === "object" && hero.content !== null && !Array.isArray(hero.content)
    ? (hero.content as Record<string, unknown>)
    : null;
  const next = content ? updatedHeroCopy(content) : null;
  // Isi hasil harus tetap lolos validator admin; kalau tidak (data lama yang tidak biasa), dibiarkan.
  const valid = next !== null && HOME_SECTION_CONTENT_SCHEMAS.HERO.safeParse(next.content).success;

  if (hero && content && next && valid) {
    const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
    await db.$transaction(async (tx) => {
      await tx.homeSection.update({ where: { id: hero.id }, data: { content: next.content as Prisma.InputJsonValue } });
      await writeAudit(
        {
          userId: owner.id,
          action: AuditAction.UPDATE,
          entity: "HomeSection",
          entityId: hero.id,
          diff: Object.fromEntries(
            next.changed.map((field) => [field, { from: content[field], to: next.content[field] }]),
          ) as Prisma.InputJsonValue,
        },
        tx,
      );
    });
    await revalidateEntity({ entity: "HomeSection" });
  }

  await db.siteSetting.upsert({
    where: { key: HOME_COPY_KEY },
    create: { key: HOME_COPY_KEY, value: HOME_COPY_VERSION },
    update: { value: HOME_COPY_VERSION },
  });
  return { changed: next && valid ? next.changed : [] };
}
