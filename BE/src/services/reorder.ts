import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { revalidateEntity, type RevalidateEvent } from "@/lib/revalidate-map";
import type { ReorderInput } from "@/lib/validators/common";
import { AuditAction, writeAudit } from "@/services/audit";

// Satu pola reorder untuk semua entitas berurutan: POST /api/admin/{resource}/reorder dengan
// daftar id LENGKAP (semua baris aktif) dalam urutan baru. Baris di Sampah tidak ikut; saat
// dipulihkan, baris ditaruh di akhir oleh service masing-masing.
// Navigasi tidak memakai ini karena urutannya per lokasi dan per parent (services/nav.ts).

type OrderedDelegate = {
  findMany(args: { where: { deletedAt: null }; select: { id: true } }): Promise<{ id: string }[]>;
  update(args: { where: { id: string }; data: { order: number; updatedById: string } }): Promise<unknown>;
};

type Reorderable = {
  entity: string;
  // Kata benda untuk pesan error, mis. "kategori".
  noun: string;
  model: (db: Prisma.TransactionClient) => OrderedDelegate;
  event: RevalidateEvent;
};

const REORDERABLE = {
  categories: {
    entity: "Category",
    noun: "kategori",
    model: (db) => db.category,
    event: { entity: "CategoryOrder" },
  },
  services: { entity: "Service", noun: "layanan", model: (db) => db.service, event: { entity: "Service", slugs: [] } },
  clients: { entity: "Client", noun: "klien", model: (db) => db.client, event: { entity: "Client" } },
  testimonials: {
    entity: "Testimonial",
    noun: "testimoni",
    model: (db) => db.testimonial,
    event: { entity: "Testimonial" },
  },
  portfolio: {
    entity: "PortfolioItem",
    noun: "portofolio",
    model: (db) => db.portfolioItem,
    event: { entity: "PortfolioItem" },
  },
  marketing: {
    entity: "MarketingContact",
    noun: "kontak marketing",
    model: (db) => db.marketingContact,
    event: { entity: "MarketingContact" },
  },
  "home-sections": {
    entity: "HomeSection",
    noun: "section",
    model: (db) => db.homeSection,
    event: { entity: "HomeSection" },
  },
} satisfies Record<string, Reorderable>;

export type ReorderResource = keyof typeof REORDERABLE;

export async function reorderResource(resource: ReorderResource, input: ReorderInput, userId: string): Promise<void> {
  const config: Reorderable = REORDERABLE[resource];
  const db = getDb();
  const active = await config.model(db).findMany({ where: { deletedAt: null }, select: { id: true } });
  const activeIds = new Set(active.map((row) => row.id));
  if (activeIds.size !== input.ids.length || !input.ids.every((id) => activeIds.has(id))) {
    throw new HttpError(422, "VALIDATION_ERROR", `Urutan harus berisi semua ${config.noun} aktif.`, {
      ids: [`Daftar ${config.noun} tidak lengkap atau berisi ${config.noun} yang sudah dihapus.`],
    });
  }
  await db.$transaction(async (tx) => {
    const model = config.model(tx);
    for (const [order, id] of input.ids.entries()) {
      await model.update({ where: { id }, data: { order, updatedById: userId } });
    }
    await writeAudit({ userId, action: AuditAction.REORDER, entity: config.entity, diff: { ids: input.ids } }, tx);
  });
  await revalidateEntity(config.event);
}

// Urutan untuk baris baru/dipulihkan: setelah baris aktif terakhir.
export async function nextOrder(
  model: { aggregate(args: { where: { deletedAt: null }; _max: { order: true } }): Promise<{ _max: { order: number | null } }> },
): Promise<number> {
  const last = await model.aggregate({ where: { deletedAt: null }, _max: { order: true } });
  return (last._max.order ?? -1) + 1;
}
