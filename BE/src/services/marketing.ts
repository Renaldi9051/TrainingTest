import type { MarketingContact, Media, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import type {
  MarketingCreateInput,
  MarketingListQuery,
  MarketingUpdateInput,
} from "@/lib/validators/marketing";
import type { OptionsQuery } from "@/lib/validators/options";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import {
  activeMediaDto,
  assertImageMedia,
  thumbnailUrl,
  toPublicImage,
  type MediaDto,
  type PublicImage,
} from "@/services/media";
import { withSelected, type OptionItem } from "@/services/options";
import { nextOrder } from "@/services/reorder";
import { whatsappUrl } from "@/services/settings";

const ENTITY = "MarketingContact";
const AUDIT_FIELDS = ["name", "area", "photoId", "phone", "defaultMessage", "active"] as const;

type MarketingRow = MarketingContact & { photo: Media | null };
const include = { photo: true } satisfies Prisma.MarketingContactInclude;

export type MarketingDto = {
  id: string;
  name: string;
  area: string | null;
  phone: string;
  defaultMessage: string | null;
  photoId: string | null;
  photo: MediaDto | null;
  active: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: MarketingRow): MarketingDto {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    phone: row.phone,
    defaultMessage: row.defaultMessage,
    photoId: row.photoId,
    photo: activeMediaDto(row.photo),
    active: row.active,
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findActive(id: string): Promise<MarketingRow> {
  const row = await getDb().marketingContact.findFirst({ where: { id, deletedAt: null }, include });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Kontak marketing tidak ditemukan.");
  return row;
}

const searchWhere = (q: string | undefined): Prisma.MarketingContactWhereInput =>
  q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q.replace(/[^\d]/g, "") || q } },
        ],
      }
    : {};

export async function listMarketing(query: MarketingListQuery): Promise<{ items: MarketingDto[]; meta: ListMeta }> {
  const where: Prisma.MarketingContactWhereInput = {
    deletedAt: null,
    ...(query.active === undefined ? {} : { active: query.active }),
    ...searchWhere(query.q),
  };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.marketingContact.findMany({
      where,
      include,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { name: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.marketingContact.count({ where }),
  ]);
  return { items: rows.map(toDto), meta: listMeta(query.page, query.pageSize, total) };
}

export async function listMarketingOptions(query: OptionsQuery): Promise<OptionItem[]> {
  const db = getDb();
  const rows = await db.marketingContact.findMany({
    where: { deletedAt: null, ...searchWhere(query.q) },
    include,
    orderBy: [{ order: "asc" }, { name: "asc" }],
    take: query.limit,
  });
  const withIds = await withSelected(rows, query.ids, (ids) =>
    db.marketingContact.findMany({ where: { id: { in: ids }, deletedAt: null }, include }),
  );
  return withIds.map((row) => ({
    id: row.id,
    label: row.name,
    sublabel: row.active ? null : "Nonaktif",
    imageUrl: thumbnailUrl(row.photo),
  }));
}

export async function getMarketing(id: string): Promise<MarketingDto> {
  return toDto(await findActive(id));
}

export async function createMarketing(input: MarketingCreateInput, userId: string): Promise<MarketingDto> {
  await assertImageMedia({ photoId: input.photoId });
  const order = await nextOrder(getDb().marketingContact);
  const created = await getDb().$transaction(async (tx) => {
    const row = await tx.marketingContact.create({
      data: {
        name: input.name,
        area: input.area,
        photoId: input.photoId,
        phone: input.phone,
        defaultMessage: input.defaultMessage,
        active: input.active,
        order,
        updatedById: userId,
      },
      include,
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
  await revalidateEntity({ entity: "MarketingContact" });
  return toDto(created);
}

export async function updateMarketing(id: string, input: MarketingUpdateInput, userId: string): Promise<MarketingDto> {
  const before = await findActive(id);
  await assertImageMedia({ photoId: input.photoId ?? null });
  const data: Prisma.MarketingContactUncheckedUpdateInput = { updatedById: userId };
  if (input.name !== undefined) data.name = input.name;
  if (input.area !== undefined) data.area = input.area;
  if (input.photoId !== undefined) data.photoId = input.photoId;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.defaultMessage !== undefined) data.defaultMessage = input.defaultMessage;
  if (input.active !== undefined) data.active = input.active;

  const updated = await getDb().$transaction(async (tx) => {
    const row = await tx.marketingContact.update({ where: { id }, data, include });
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
  await revalidateEntity({ entity: "MarketingContact" });
  return toDto(updated);
}

export async function deleteMarketing(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.marketingContact.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { name: row.name } },
      tx,
    );
  });
  await revalidateEntity({ entity: "MarketingContact" });
}

export async function restoreMarketing(id: string, userId: string): Promise<MarketingDto> {
  const row = await getDb().marketingContact.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Kontak marketing tidak ditemukan di Sampah.");
  const order = await nextOrder(getDb().marketingContact);
  const restored = await getDb().$transaction(async (tx) => {
    const updated = await tx.marketingContact.update({
      where: { id },
      data: { deletedAt: null, order, updatedById: userId },
      include,
    });
    await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
    return updated;
  });
  await revalidateEntity({ entity: "MarketingContact" });
  return toDto(restored);
}

// ===== Publik =====

// Hanya kontak aktif. Nomor dipakai untuk tautan WhatsApp, jadi memang publik.
export type PublicMarketingContact = {
  name: string;
  // null = tidak tampil.
  area: string | null;
  phone: string;
  whatsappUrl: string | null;
  defaultMessage: string | null;
  photo: PublicImage | null;
};

export function toPublicMarketing(row: MarketingRow): PublicMarketingContact {
  return {
    name: row.name,
    area: row.area,
    phone: row.phone,
    whatsappUrl: whatsappUrl(row.phone, row.defaultMessage ?? undefined),
    defaultMessage: row.defaultMessage,
    photo: toPublicImage(activeMediaDto(row.photo)),
  };
}

export async function listPublicMarketing(): Promise<PublicMarketingContact[]> {
  const rows = await getDb().marketingContact.findMany({
    where: { deletedAt: null, active: true },
    include,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(toPublicMarketing);
}
