import type { Media, PortfolioImage, PortfolioItem, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import { toDateString } from "@/lib/time";
import type { OptionsQuery } from "@/lib/validators/options";
import type {
  PortfolioCreateInput,
  PortfolioListQuery,
  PortfolioUpdateInput,
  PortfolioActivityType,
} from "@/lib/validators/portfolio";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import {
  activeMediaDto,
  assertMediaRefs,
  thumbnailUrl,
  toPublicImage,
  type MediaDto,
  type PublicImage,
} from "@/services/media";
import { withSelected, type OptionItem } from "@/services/options";
import { nextOrder } from "@/services/reorder";

const ENTITY = "PortfolioItem";
const AUDIT_FIELDS = ["title", "activityType", "date", "client", "description", "imageIds"] as const;

type PortfolioRow = PortfolioItem & { images: (PortfolioImage & { media: Media })[] };
const include = {
  images: { orderBy: { order: "asc" }, include: { media: true } },
} satisfies Prisma.PortfolioItemInclude;

export type PortfolioDto = {
  id: string;
  title: string;
  activityType: PortfolioActivityType | null;
  date: string | null;
  client: string | null;
  description: string | null;
  // Galeri berurutan; gambar yang sudah di Sampah tidak ikut.
  imageIds: string[];
  images: MediaDto[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

function activeImages(row: PortfolioRow): Media[] {
  return row.images.map((link) => link.media).filter((media) => media.deletedAt === null);
}

function toDto(row: PortfolioRow): PortfolioDto {
  const images = activeImages(row);
  return {
    id: row.id,
    title: row.title,
    activityType: row.activityType,
    date: row.date ? toDateString(row.date) : null,
    client: row.client,
    description: row.description,
    imageIds: images.map((media) => media.id),
    images: images.flatMap((media) => activeMediaDto(media) ?? []),
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function auditShape(row: PortfolioRow) {
  const dto = toDto(row);
  return {
    title: dto.title,
    activityType: dto.activityType,
    date: dto.date,
    client: dto.client,
    description: dto.description,
    imageIds: dto.imageIds,
  };
}

const toDbDate = (value: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

// Setiap gambar galeri: media gambar aktif yang sudah punya alt (tampil di publik, PRD 6.3).
// Error per index field form, mis. imageIds.2.
async function assertGallery(imageIds: string[]): Promise<void> {
  await assertMediaRefs(
    imageIds.map((mediaId, index) => ({ field: `imageIds.${index}`, mediaId, kind: "image", requireAlt: true })),
  );
}

async function findActive(id: string): Promise<PortfolioRow> {
  const row = await getDb().portfolioItem.findFirst({ where: { id, deletedAt: null }, include });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Portofolio tidak ditemukan.");
  return row;
}

const searchWhere = (q: string | undefined): Prisma.PortfolioItemWhereInput =>
  q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { client: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

export async function listPortfolio(query: PortfolioListQuery): Promise<{ items: PortfolioDto[]; meta: ListMeta }> {
  const where: Prisma.PortfolioItemWhereInput = { deletedAt: null, ...searchWhere(query.q) };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.portfolioItem.findMany({
      where,
      include,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { title: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.portfolioItem.count({ where }),
  ]);
  return { items: rows.map(toDto), meta: listMeta(query.page, query.pageSize, total) };
}

export async function listPortfolioOptions(query: OptionsQuery): Promise<OptionItem[]> {
  const db = getDb();
  const rows = await db.portfolioItem.findMany({
    where: { deletedAt: null, ...searchWhere(query.q) },
    include,
    orderBy: [{ order: "asc" }, { title: "asc" }],
    take: query.limit,
  });
  const withIds = await withSelected(rows, query.ids, (ids) =>
    db.portfolioItem.findMany({ where: { id: { in: ids }, deletedAt: null }, include }),
  );
  return withIds.map((row) => ({
    id: row.id,
    label: row.title,
    sublabel: row.client,
    imageUrl: thumbnailUrl(activeImages(row)[0]),
  }));
}

export async function getPortfolio(id: string): Promise<PortfolioDto> {
  return toDto(await findActive(id));
}

export async function createPortfolio(input: PortfolioCreateInput, userId: string): Promise<PortfolioDto> {
  await assertGallery(input.imageIds);
  const order = await nextOrder(getDb().portfolioItem);
  const created = await getDb().$transaction(async (tx) => {
    const row = await tx.portfolioItem.create({
      data: {
        title: input.title,
        activityType: input.activityType,
        date: toDbDate(input.date),
        client: input.client,
        description: input.description,
        order,
        updatedById: userId,
        images: { create: input.imageIds.map((mediaId, index) => ({ mediaId, order: index })) },
      },
      include,
    });
    await writeAudit(
      {
        userId,
        action: AuditAction.CREATE,
        entity: ENTITY,
        entityId: row.id,
        diff: diffFields(null, auditShape(row), AUDIT_FIELDS) as Prisma.InputJsonValue,
      },
      tx,
    );
    return row;
  });
  await revalidateEntity({ entity: "PortfolioItem" });
  return toDto(created);
}

export async function updatePortfolio(id: string, input: PortfolioUpdateInput, userId: string): Promise<PortfolioDto> {
  const before = await findActive(id);
  if (input.imageIds) await assertGallery(input.imageIds);
  const data: Prisma.PortfolioItemUncheckedUpdateInput = { updatedById: userId };
  if (input.title !== undefined) data.title = input.title;
  if (input.date !== undefined) data.date = toDbDate(input.date);
  if (input.activityType !== undefined) data.activityType = input.activityType;
  if (input.client !== undefined) data.client = input.client;
  if (input.description !== undefined) data.description = input.description;

  const updated = await getDb().$transaction(async (tx) => {
    // Galeri diganti utuh sesuai urutan imageIds.
    if (input.imageIds) {
      await tx.portfolioImage.deleteMany({ where: { portfolioItemId: id } });
      await tx.portfolioImage.createMany({
        data: input.imageIds.map((mediaId, index) => ({ portfolioItemId: id, mediaId, order: index })),
      });
    }
    const row = await tx.portfolioItem.update({ where: { id }, data, include });
    await writeAudit(
      {
        userId,
        action: AuditAction.UPDATE,
        entity: ENTITY,
        entityId: id,
        diff: diffFields(auditShape(before), auditShape(row), AUDIT_FIELDS) as Prisma.InputJsonValue,
      },
      tx,
    );
    return row;
  });
  await revalidateEntity({ entity: "PortfolioItem" });
  return toDto(updated);
}

export async function deletePortfolio(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.portfolioItem.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { title: row.title } },
      tx,
    );
  });
  await revalidateEntity({ entity: "PortfolioItem" });
}

export async function restorePortfolio(id: string, userId: string): Promise<PortfolioDto> {
  const row = await getDb().portfolioItem.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Portofolio tidak ditemukan di Sampah.");
  const order = await nextOrder(getDb().portfolioItem);
  const restored = await getDb().$transaction(async (tx) => {
    const updated = await tx.portfolioItem.update({
      where: { id },
      data: { deletedAt: null, order, updatedById: userId },
      include,
    });
    await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
    return updated;
  });
  await revalidateEntity({ entity: "PortfolioItem" });
  return toDto(restored);
}

// ===== Publik =====

export type PublicPortfolioItem = {
  title: string;
  // null = belum diisi; item tetap tampil di "Semua", tidak ikut chip jenis.
  activityType: PortfolioActivityType | null;
  date: string | null;
  client: string | null;
  description: string | null;
  images: PublicImage[];
};

export function toPublicPortfolio(row: PortfolioRow): PublicPortfolioItem {
  return {
    title: row.title,
    activityType: row.activityType,
    date: row.date ? toDateString(row.date) : null,
    client: row.client,
    description: row.description,
    images: activeImages(row).flatMap((media) => toPublicImage(activeMediaDto(media)) ?? []),
  };
}

export async function listPublicPortfolio(): Promise<PublicPortfolioItem[]> {
  const rows = await getDb().portfolioItem.findMany({
    where: { deletedAt: null },
    include,
    orderBy: [{ order: "asc" }, { date: "desc" }],
  });
  return rows.map(toPublicPortfolio);
}
