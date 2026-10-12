import type { Client, Media, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import type { ClientCreateInput, ClientListQuery, ClientUpdateInput } from "@/lib/validators/client";
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

const ENTITY = "Client";
const AUDIT_FIELDS = ["name", "logoId", "url"] as const;

type ClientRow = Client & { logo: Media | null };
const include = { logo: true } satisfies Prisma.ClientInclude;

export type ClientDto = {
  id: string;
  name: string;
  url: string | null;
  logoId: string | null;
  logo: MediaDto | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: ClientRow): ClientDto {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    logoId: row.logoId,
    logo: activeMediaDto(row.logo),
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findActive(id: string): Promise<ClientRow> {
  const row = await getDb().client.findFirst({ where: { id, deletedAt: null }, include });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Klien tidak ditemukan.");
  return row;
}

const searchWhere = (q: string | undefined): Prisma.ClientWhereInput =>
  q ? { name: { contains: q, mode: "insensitive" } } : {};

export async function listClients(query: ClientListQuery): Promise<{ items: ClientDto[]; meta: ListMeta }> {
  const where: Prisma.ClientWhereInput = { deletedAt: null, ...searchWhere(query.q) };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.client.findMany({
      where,
      include,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { name: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.client.count({ where }),
  ]);
  return { items: rows.map(toDto), meta: listMeta(query.page, query.pageSize, total) };
}

export async function listClientOptions(query: OptionsQuery): Promise<OptionItem[]> {
  const db = getDb();
  const rows = await db.client.findMany({
    where: { deletedAt: null, ...searchWhere(query.q) },
    include,
    orderBy: [{ order: "asc" }, { name: "asc" }],
    take: query.limit,
  });
  const withIds = await withSelected(rows, query.ids, (ids) =>
    db.client.findMany({ where: { id: { in: ids }, deletedAt: null }, include }),
  );
  return withIds.map((row) => ({ id: row.id, label: row.name, sublabel: null, imageUrl: thumbnailUrl(row.logo) }));
}

export async function getClient(id: string): Promise<ClientDto> {
  return toDto(await findActive(id));
}

export async function createClient(input: ClientCreateInput, userId: string): Promise<ClientDto> {
  await assertImageMedia({ logoId: input.logoId });
  const order = await nextOrder(getDb().client);
  const created = await getDb().$transaction(async (tx) => {
    const row = await tx.client.create({
      data: { name: input.name, logoId: input.logoId, url: input.url, order, updatedById: userId },
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
  await revalidateEntity({ entity: "Client" });
  return toDto(created);
}

export async function updateClient(id: string, input: ClientUpdateInput, userId: string): Promise<ClientDto> {
  const before = await findActive(id);
  await assertImageMedia({ logoId: input.logoId ?? null });
  const data: Prisma.ClientUncheckedUpdateInput = { updatedById: userId };
  if (input.name !== undefined) data.name = input.name;
  if (input.logoId !== undefined) data.logoId = input.logoId;
  if (input.url !== undefined) data.url = input.url;

  const updated = await getDb().$transaction(async (tx) => {
    const row = await tx.client.update({ where: { id }, data, include });
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
  await revalidateEntity({ entity: "Client" });
  return toDto(updated);
}

export async function deleteClient(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.client.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { name: row.name } },
      tx,
    );
  });
  await revalidateEntity({ entity: "Client" });
}

export async function restoreClient(id: string, userId: string): Promise<ClientDto> {
  const row = await getDb().client.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Klien tidak ditemukan di Sampah.");
  const order = await nextOrder(getDb().client);
  const restored = await getDb().$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id },
      data: { deletedAt: null, order, updatedById: userId },
      include,
    });
    await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
    return updated;
  });
  await revalidateEntity({ entity: "Client" });
  return toDto(restored);
}

// ===== Publik =====

export type PublicClient = { name: string; url: string | null; logo: PublicImage | null };

export function toPublicClient(row: ClientRow): PublicClient {
  return { name: row.name, url: row.url, logo: toPublicImage(activeMediaDto(row.logo)) };
}

export async function listPublicClients(): Promise<PublicClient[]> {
  const rows = await getDb().client.findMany({
    where: { deletedAt: null },
    include,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(toPublicClient);
}
