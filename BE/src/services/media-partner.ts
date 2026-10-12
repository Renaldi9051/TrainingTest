import type { MediaPartner, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import type {
  MediaPartnerCreateInput,
  MediaPartnerListQuery,
  MediaPartnerUpdateInput,
} from "@/lib/validators/media-partner";
import type { OptionsQuery } from "@/lib/validators/options";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { withSelected, type OptionItem } from "@/services/options";
import { nextOrder } from "@/services/reorder";

const ENTITY = "MediaPartner";
const AUDIT_FIELDS = ["name", "url"] as const;

export type MediaPartnerDto = {
  id: string;
  name: string;
  url: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: MediaPartner): MediaPartnerDto {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findActive(id: string): Promise<MediaPartner> {
  const row = await getDb().mediaPartner.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Media partner tidak ditemukan.");
  return row;
}

const searchWhere = (q: string | undefined): Prisma.MediaPartnerWhereInput =>
  q ? { name: { contains: q, mode: "insensitive" } } : {};

export async function listMediaPartners(
  query: MediaPartnerListQuery,
): Promise<{ items: MediaPartnerDto[]; meta: ListMeta }> {
  const where: Prisma.MediaPartnerWhereInput = { deletedAt: null, ...searchWhere(query.q) };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.mediaPartner.findMany({
      where,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { name: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.mediaPartner.count({ where }),
  ]);
  return { items: rows.map(toDto), meta: listMeta(query.page, query.pageSize, total) };
}

export async function listMediaPartnerOptions(query: OptionsQuery): Promise<OptionItem[]> {
  const db = getDb();
  const rows = await db.mediaPartner.findMany({
    where: { deletedAt: null, ...searchWhere(query.q) },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    take: query.limit,
  });
  const withIds = await withSelected(rows, query.ids, (ids) =>
    db.mediaPartner.findMany({ where: { id: { in: ids }, deletedAt: null } }),
  );
  return withIds.map((row) => ({ id: row.id, label: row.name, sublabel: row.url, imageUrl: null }));
}

export async function getMediaPartner(id: string): Promise<MediaPartnerDto> {
  return toDto(await findActive(id));
}

export async function createMediaPartner(input: MediaPartnerCreateInput, userId: string): Promise<MediaPartnerDto> {
  const order = await nextOrder(getDb().mediaPartner);
  const created = await getDb().$transaction(async (tx) => {
    const row = await tx.mediaPartner.create({
      data: { name: input.name, url: input.url, order, updatedById: userId },
    });
    await writeAudit(
      {
        userId,
        action: AuditAction.CREATE,
        entity: ENTITY,
        entityId: row.id,
        diff: diffFields(null, row, AUDIT_FIELDS) as Prisma.InputJsonValue,
      },
      tx,
    );
    return row;
  });
  await revalidateEntity({ entity: "MediaPartner" });
  return toDto(created);
}

export async function updateMediaPartner(
  id: string,
  input: MediaPartnerUpdateInput,
  userId: string,
): Promise<MediaPartnerDto> {
  const before = await findActive(id);
  const data: Prisma.MediaPartnerUncheckedUpdateInput = { updatedById: userId };
  if (input.name !== undefined) data.name = input.name;
  if (input.url !== undefined) data.url = input.url;

  const updated = await getDb().$transaction(async (tx) => {
    const row = await tx.mediaPartner.update({ where: { id }, data });
    await writeAudit(
      {
        userId,
        action: AuditAction.UPDATE,
        entity: ENTITY,
        entityId: id,
        diff: diffFields(before, row, AUDIT_FIELDS) as Prisma.InputJsonValue,
      },
      tx,
    );
    return row;
  });
  await revalidateEntity({ entity: "MediaPartner" });
  return toDto(updated);
}

export async function deleteMediaPartner(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.mediaPartner.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { name: row.name } },
      tx,
    );
  });
  await revalidateEntity({ entity: "MediaPartner" });
}

export async function restoreMediaPartner(id: string, userId: string): Promise<MediaPartnerDto> {
  const row = await getDb().mediaPartner.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Media partner tidak ditemukan di Sampah.");
  const order = await nextOrder(getDb().mediaPartner);
  const restored = await getDb().$transaction(async (tx) => {
    const updated = await tx.mediaPartner.update({
      where: { id },
      data: { deletedAt: null, order, updatedById: userId },
    });
    await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
    return updated;
  });
  await revalidateEntity({ entity: "MediaPartner" });
  return toDto(restored);
}

// ===== Publik =====

export type PublicMediaPartner = { name: string; url: string | null };

export function toPublicMediaPartner(row: MediaPartner): PublicMediaPartner {
  return { name: row.name, url: row.url };
}

export async function listPublicMediaPartners(): Promise<PublicMediaPartner[]> {
  const rows = await getDb().mediaPartner.findMany({
    where: { deletedAt: null },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(toPublicMediaPartner);
}
