import { Prisma, type Media, type Service } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import { renderRichText, type RichTextDoc } from "@/lib/rich-text";
import {
  assertSlugAvailable,
  nextAvailableSlug,
  slugify,
  type SlugLookup,
  withSlugConflict,
} from "@/lib/slug";
import type { ReorderInput, RestoreInput, SeoInput } from "@/lib/validators/common";
import type { OptionsQuery } from "@/lib/validators/options";
import type { ServiceCreateInput, ServiceListQuery, ServiceUpdateInput } from "@/lib/validators/service";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import {
  activeMediaDto,
  assertMediaRefs,
  getMediaMap,
  thumbnailUrl,
  toPublicImage,
  type MediaDto,
  type PublicImage,
} from "@/services/media";
import { withSelected, type OptionItem } from "@/services/options";
import { publicPath, recordSlugRedirect, releaseRedirectPath } from "@/services/redirect";
import { nextOrder, reorderResource } from "@/services/reorder";
import { resolveSelections, type Selection } from "@/services/selection";
import { parseSeo, type TrainingSeo } from "@/services/training";

const ENTITY = "Service";
const AUDIT_FIELDS = ["slug", "title", "icon", "summary", "imageId", "status", "body", "seo"] as const;

type ServiceRow = Service & { image: Media | null };
const include = { image: true } satisfies Prisma.ServiceInclude;

// ===== DTO admin =====

export type ServiceListItem = {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
  summary: string | null;
  image: MediaDto | null;
  order: number;
  status: "DRAFT" | "PUBLISHED";
  updatedAt: Date;
};

export type ServiceDto = ServiceListItem & {
  body: RichTextDoc | null;
  imageId: string | null;
  seo: TrainingSeo;
  ogImage: MediaDto | null;
  createdAt: Date;
};

function toListItem(row: ServiceRow): ServiceListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    icon: row.icon,
    summary: row.summary,
    image: activeMediaDto(row.image),
    order: row.order,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

async function toDto(row: ServiceRow): Promise<ServiceDto> {
  const seo = parseSeo(row.seo);
  const media = await getMediaMap([seo.ogImageId]);
  return {
    ...toListItem(row),
    // Disimpan setelah lolos allowlist rich text; dibaca apa adanya untuk editor.
    body: (row.body ?? null) as RichTextDoc | null,
    imageId: row.imageId,
    seo,
    ogImage: seo.ogImageId ? (media.get(seo.ogImageId) ?? null) : null,
    createdAt: row.createdAt,
  };
}

function seoJson(seo: SeoInput): Prisma.InputJsonValue {
  return { title: seo.title, description: seo.description, ogImageId: seo.ogImageId };
}

function bodyJson(body: RichTextDoc | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return body ? (body as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
}

function auditShape(row: Service) {
  return {
    slug: row.slug,
    title: row.title,
    icon: row.icon,
    summary: row.summary,
    imageId: row.imageId,
    status: row.status,
    body: row.body,
    seo: row.seo,
  };
}

export const serviceSlugLookup: SlugLookup = (args) => getDb().service.findFirst(args);

async function findActive(id: string): Promise<ServiceRow> {
  const row = await getDb().service.findFirst({ where: { id, deletedAt: null }, include });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Layanan tidak ditemukan.");
  return row;
}

// ===== Admin =====

export async function listServices(query: ServiceListQuery): Promise<{ items: ServiceListItem[]; meta: ListMeta }> {
  const where: Prisma.ServiceWhereInput = {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { slug: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.service.findMany({
      where,
      include,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { title: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.service.count({ where }),
  ]);
  return { items: rows.map(toListItem), meta: listMeta(query.page, query.pageSize, total) };
}

function toOption(row: ServiceRow): OptionItem {
  return {
    id: row.id,
    label: row.title,
    sublabel: row.status === "DRAFT" ? "Draf" : null,
    imageUrl: thumbnailUrl(row.image),
  };
}

export async function listServiceOptions(query: OptionsQuery): Promise<OptionItem[]> {
  const db = getDb();
  const rows = await db.service.findMany({
    where: { deletedAt: null, ...(query.q ? { title: { contains: query.q, mode: "insensitive" } } : {}) },
    include,
    orderBy: [{ order: "asc" }, { title: "asc" }],
    take: query.limit,
  });
  const withIds = await withSelected(rows, query.ids, (ids) =>
    db.service.findMany({ where: { id: { in: ids }, deletedAt: null }, include }),
  );
  return withIds.map(toOption);
}

export async function getService(id: string): Promise<ServiceDto> {
  return toDto(await findActive(id));
}

export async function createService(input: ServiceCreateInput, userId: string): Promise<ServiceDto> {
  await assertMediaRefs([
    { field: "imageId", mediaId: input.imageId, kind: "image", requireAlt: true },
    { field: "seo.ogImageId", mediaId: input.seo.ogImageId, kind: "image" },
  ]);
  const slug = input.slug ?? (await nextAvailableSlug(serviceSlugLookup, slugify(input.title) || "layanan"));
  if (input.slug) await assertSlugAvailable(serviceSlugLookup, slug);
  const order = await nextOrder(getDb().service);

  const created = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.service.create({
        data: {
          slug,
          title: input.title,
          icon: input.icon,
          summary: input.summary,
          body: bodyJson(input.body),
          imageId: input.imageId,
          order,
          status: input.status,
          seo: seoJson(input.seo),
          updatedById: userId,
        },
        include,
      });
      await releaseRedirectPath(tx, publicPath.service(slug), userId);
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
    }),
  );

  if (created.status === "PUBLISHED") await revalidateEntity({ entity: "Service", slugs: [created.slug] });
  return toDto(created);
}

export async function updateService(id: string, input: ServiceUpdateInput, userId: string): Promise<ServiceDto> {
  const before = await findActive(id);
  const slugChanged = input.slug !== undefined && input.slug !== before.slug;
  if (slugChanged && input.slug) await assertSlugAvailable(serviceSlugLookup, input.slug, id);
  await assertMediaRefs([
    { field: "imageId", mediaId: input.imageId, kind: "image", requireAlt: true },
    { field: "seo.ogImageId", mediaId: input.seo?.ogImageId, kind: "image" },
  ]);

  const data: Prisma.ServiceUncheckedUpdateInput = { updatedById: userId };
  if (input.title !== undefined) data.title = input.title;
  if (slugChanged) data.slug = input.slug;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.body !== undefined) data.body = bodyJson(input.body);
  if (input.imageId !== undefined) data.imageId = input.imageId;
  if (input.status !== undefined) data.status = input.status;
  if (input.seo !== undefined) data.seo = seoJson(input.seo);

  const updated = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.service.update({ where: { id }, data, include });
      // Redirect hanya untuk URL yang pernah tayang. recordSlugRedirect meratakan rantai
      // (A->B lalu B->C jadi A->C) dan melepas redirect dari slug tujuan (kembali ke A: tanpa loop).
      if (slugChanged && before.status === "PUBLISHED") {
        await recordSlugRedirect(tx, {
          from: publicPath.service(before.slug),
          to: publicPath.service(row.slug),
          userId,
        });
      } else if (slugChanged) {
        await releaseRedirectPath(tx, publicPath.service(row.slug), userId);
      }
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
    }),
  );

  await revalidateEntity({ entity: "Service", slugs: [updated.slug, slugChanged ? before.slug : null] });
  return toDto(updated);
}

export async function deleteService(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { slug: row.slug } },
      tx,
    );
  });
  await revalidateEntity({ entity: "Service", slugs: [row.slug] });
}

// Pulihkan dari Sampah ke urutan terakhir. Slug lama dipakai layanan lain: 409, kirim slug baru.
export async function restoreService(id: string, input: RestoreInput, userId: string): Promise<ServiceDto> {
  const row = await getDb().service.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Layanan tidak ditemukan di Sampah.");
  const slug = input.slug ?? row.slug;
  await assertSlugAvailable(serviceSlugLookup, slug, id);
  const order = await nextOrder(getDb().service);

  const restored = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id },
        data: { deletedAt: null, slug, order, updatedById: userId },
        include,
      });
      await releaseRedirectPath(tx, publicPath.service(slug), userId);
      await writeAudit(
        {
          userId,
          action: AuditAction.RESTORE,
          entity: ENTITY,
          entityId: id,
          diff: slug === row.slug ? undefined : { slug: { from: row.slug, to: slug } },
        },
        tx,
      );
      return updated;
    }),
  );
  await revalidateEntity({ entity: "Service", slugs: [restored.slug] });
  return toDto(restored);
}

export async function reorderServices(input: ReorderInput, userId: string): Promise<void> {
  await reorderResource("services", input, userId);
}

// ===== Publik =====

export type PublicServiceCard = {
  slug: string;
  title: string;
  icon: string | null;
  summary: string | null;
  image: PublicImage | null;
};

export type PublicServiceDetail = PublicServiceCard & {
  bodyHtml: string | null;
  seo: { title: string; description: string; ogImage: PublicImage | null };
  updatedAt: Date;
};

export const publicServiceWhere = { deletedAt: null, status: "PUBLISHED" } satisfies Prisma.ServiceWhereInput;

export function toPublicServiceCard(row: ServiceRow): PublicServiceCard {
  return {
    slug: row.slug,
    title: row.title,
    icon: row.icon,
    summary: row.summary,
    image: toPublicImage(activeMediaDto(row.image)),
  };
}

async function toPublicDetail(row: ServiceRow): Promise<PublicServiceDetail> {
  const card = toPublicServiceCard(row);
  const seo = parseSeo(row.seo);
  const media = await getMediaMap([seo.ogImageId]);
  return {
    ...card,
    bodyHtml: renderRichText(row.body),
    seo: {
      title: seo.title,
      description: seo.description,
      ogImage: toPublicImage(seo.ogImageId ? media.get(seo.ogImageId) : null) ?? card.image,
    },
    updatedAt: row.updatedAt,
  };
}

export async function listPublicServices(): Promise<PublicServiceCard[]> {
  const rows = await getDb().service.findMany({
    where: publicServiceWhere,
    include,
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  return rows.map(toPublicServiceCard);
}

export async function getPublicService(slug: string): Promise<PublicServiceDetail | null> {
  const row = await getDb().service.findFirst({ where: { slug, ...publicServiceWhere }, include });
  return row ? toPublicDetail(row) : null;
}

// Pratinjau admin (draft mode): bentuk sama dengan detail publik, termasuk draft.
export async function getServicePreview(slug: string): Promise<PublicServiceDetail | null> {
  const row = await getDb().service.findFirst({ where: { slug, deletedAt: null }, include });
  return row ? toPublicDetail(row) : null;
}

// Konfigurasi pilihan layanan dari blok halaman / section beranda (bukan salinan data).
export type ServiceSelection = Selection;

// Resolve banyak konfigurasi sekaligus (lihat resolveSelections): id yang dihapus/draft tersaring,
// urutan manual dijaga, mode auto mengikuti urutan modul Layanan.
export async function resolveServiceSelections(selections: Selection[]): Promise<PublicServiceCard[][]> {
  const db = getDb();
  return resolveSelections(selections, {
    byIds: (ids) => db.service.findMany({ where: { id: { in: ids }, ...publicServiceWhere }, include }),
    top: (limit) =>
      db.service.findMany({ where: publicServiceWhere, include, orderBy: [{ order: "asc" }, { title: "asc" }], take: limit }),
    toItem: toPublicServiceCard,
  });
}
