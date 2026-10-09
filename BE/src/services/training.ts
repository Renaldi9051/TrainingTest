import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateTags, RevalidateTag, tags } from "@/lib/revalidate";
import {
  assertSlugAvailable,
  nextAvailableSlug,
  slugify,
  type SlugLookup,
  withSlugConflict,
} from "@/lib/slug";
import type { RestoreInput, SeoInput } from "@/lib/validators/common";
import type {
  TrainingBulkInput,
  TrainingCreateInput,
  TrainingListQuery,
  TrainingUpdateInput,
} from "@/lib/validators/training";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { assertImageMedia, getMediaMap, toMediaDto, type MediaDto } from "@/services/media";
import { publicPath, recordSlugRedirect, releaseRedirectPath } from "@/services/redirect";
import { isPubliclyVisible } from "@/services/training-visibility";

const ENTITY = "Training";

const AUDIT_FIELDS = [
  "title",
  "slug",
  "summary",
  "body",
  "objectives",
  "syllabus",
  "audience",
  "facilities",
  "duration",
  "method",
  "types",
  "priceText",
  "showPrice",
  "coverId",
  "status",
  "publishedAt",
  "seo",
  "categoryIds",
] as const;

const adminInclude = {
  cover: true,
  categories: {
    include: { category: { select: { id: true, slug: true, name: true, order: true, deletedAt: true } } },
  },
  _count: { select: { schedules: { where: { deletedAt: null } } } },
} satisfies Prisma.TrainingInclude;

type TrainingRow = Prisma.TrainingGetPayload<{ include: typeof adminInclude }>;

export type TrainingPublicState = "DRAFT" | "SCHEDULED" | "PUBLISHED";

export type TrainingCategoryRef = { id: string; slug: string; name: string };

export type TrainingSeo = { title: string; description: string; ogImageId: string | null };

export type TrainingListItem = {
  id: string;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  publicState: TrainingPublicState;
  publishedAt: Date | null;
  method: string | null;
  types: string[];
  categories: TrainingCategoryRef[];
  cover: MediaDto | null;
  scheduleCount: number;
  updatedAt: Date;
};

export type TrainingDto = TrainingListItem & {
  summary: string | null;
  body: unknown;
  objectives: unknown;
  syllabus: unknown;
  audience: unknown;
  facilities: unknown;
  duration: string | null;
  priceText: string | null;
  showPrice: boolean;
  coverId: string | null;
  seo: TrainingSeo;
  ogImage: MediaDto | null;
  createdAt: Date;
};

export function publicState(
  training: { status: string; publishedAt: Date | null },
  now = new Date(),
): TrainingPublicState {
  if (training.status !== "PUBLISHED") return "DRAFT";
  return training.publishedAt && training.publishedAt.getTime() > now.getTime() ? "SCHEDULED" : "PUBLISHED";
}

export function parseSeo(value: unknown): TrainingSeo {
  const seo = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    title: typeof seo.title === "string" ? seo.title : "",
    description: typeof seo.description === "string" ? seo.description : "",
    ogImageId: typeof seo.ogImageId === "string" ? seo.ogImageId : null,
  };
}

function activeCategories(row: TrainingRow): TrainingCategoryRef[] {
  return row.categories
    .map((link) => link.category)
    .filter((category) => category.deletedAt === null)
    .sort((a, b) => a.order - b.order)
    .map(({ id, slug, name }) => ({ id, slug, name }));
}

function toListItem(row: TrainingRow, now: Date): TrainingListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    publicState: publicState(row, now),
    publishedAt: row.publishedAt,
    method: row.method,
    types: row.types,
    categories: activeCategories(row),
    cover: row.cover && row.cover.deletedAt === null ? toMediaDto(row.cover) : null,
    scheduleCount: row._count.schedules,
    updatedAt: row.updatedAt,
  };
}

async function toDto(row: TrainingRow, now = new Date()): Promise<TrainingDto> {
  const seo = parseSeo(row.seo);
  const media = await getMediaMap([seo.ogImageId]);
  return {
    ...toListItem(row, now),
    summary: row.summary,
    body: row.body,
    objectives: row.objectives,
    syllabus: row.syllabus,
    audience: row.audience,
    facilities: row.facilities,
    duration: row.duration,
    priceText: row.priceText,
    showPrice: row.showPrice,
    coverId: row.coverId,
    seo,
    ogImage: seo.ogImageId ? (media.get(seo.ogImageId) ?? null) : null,
    createdAt: row.createdAt,
  };
}

const slugLookup: SlugLookup = (args) => getDb().training.findFirst(args);

// Bentuk untuk audit/diff: kolom + daftar id kategori.
function auditShape(row: TrainingRow | null) {
  if (!row) return null;
  return { ...row, categoryIds: activeCategories(row).map((category) => category.id) };
}

// ===== List & detail =====

export async function listTrainings(
  query: TrainingListQuery,
  now = new Date(),
): Promise<{ items: TrainingListItem[]; meta: ListMeta }> {
  const statusWhere: Prisma.TrainingWhereInput =
    query.status === "DRAFT"
      ? { status: "DRAFT" }
      : query.status === "SCHEDULED"
        ? { status: "PUBLISHED", publishedAt: { gt: now } }
        : query.status === "PUBLISHED"
          ? { status: "PUBLISHED", publishedAt: { lte: now } }
          : {};
  const where: Prisma.TrainingWhereInput = {
    deletedAt: null,
    ...statusWhere,
    ...(query.method ? { method: query.method } : {}),
    ...(query.type ? { types: { has: query.type } } : {}),
    ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
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
    db.training.findMany({
      where,
      include: adminInclude,
      orderBy: [
        // publishedAt bisa null (draf): taruh di akhir. Kolom lain tidak nullable.
        query.sort.field === "publishedAt"
          ? { publishedAt: { sort: query.sort.direction, nulls: "last" } }
          : { [query.sort.field]: query.sort.direction },
        { id: "asc" },
      ],
      ...pagination(query.page, query.pageSize),
    }),
    db.training.count({ where }),
  ]);
  return { items: rows.map((row) => toListItem(row, now)), meta: listMeta(query.page, query.pageSize, total) };
}

async function findActive(id: string): Promise<TrainingRow> {
  const row = await getDb().training.findFirst({ where: { id, deletedAt: null }, include: adminInclude });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Pelatihan tidak ditemukan.");
  return row;
}

export async function getTraining(id: string): Promise<TrainingDto> {
  return toDto(await findActive(id));
}

// ===== Validasi relasi =====

async function assertActiveCategories(ids: string[], db: Pick<Prisma.TransactionClient, "category"> = getDb()) {
  const found = await db.category.count({ where: { id: { in: ids }, deletedAt: null } });
  if (found !== ids.length) {
    throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid.", {
      categoryIds: ["Ada kategori yang tidak ditemukan atau sudah dihapus."],
    });
  }
}

function assertPrice(showPrice: boolean, priceText: string | null) {
  if (showPrice && !priceText) {
    throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid.", {
      priceText: ["Isi teks investasi atau matikan opsi tampilkan harga."],
    });
  }
}

// Publish tanpa waktu = sekarang. Waktu publish yang sudah lewat langsung tayang (revalidate
// sekarang); waktu di masa depan ditangani scheduler (publishRevalidatedAt dibiarkan null).
function resolvePublish(
  status: "DRAFT" | "PUBLISHED",
  publishedAt: Date | null,
  now: Date,
): { publishedAt: Date | null; publishRevalidatedAt: Date | null } {
  if (status !== "PUBLISHED") return { publishedAt, publishRevalidatedAt: null };
  const at = publishedAt ?? now;
  return { publishedAt: at, publishRevalidatedAt: at.getTime() <= now.getTime() ? now : null };
}

function trainingTags(slugs: (string | null | undefined)[]): string[] {
  return tags(
    RevalidateTag.TRAININGS,
    RevalidateTag.CATEGORIES,
    RevalidateTag.SCHEDULES,
    ...slugs.map((slug) => (slug ? RevalidateTag.training(slug) : null)),
  );
}

function seoJson(seo: SeoInput): Prisma.InputJsonValue {
  return { title: seo.title, description: seo.description, ogImageId: seo.ogImageId };
}

// Kolom Json nullable: null harus dikirim sebagai Prisma.DbNull (NULL SQL), bukan JSON null.
function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

// ===== Create / update =====

export async function createTraining(
  input: TrainingCreateInput,
  userId: string,
  now = new Date(),
): Promise<TrainingDto> {
  await assertActiveCategories(input.categoryIds);
  await assertImageMedia({ coverId: input.coverId, "seo.ogImageId": input.seo.ogImageId });

  const slug = input.slug ?? (await nextAvailableSlug(slugLookup, slugify(input.title) || "pelatihan"));
  if (input.slug) await assertSlugAvailable(slugLookup, slug);
  const publish = resolvePublish(input.status, input.publishedAt, now);

  const created = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.training.create({
        data: {
          slug,
          title: input.title,
          summary: input.summary,
          body: jsonOrNull(input.body),
          objectives: jsonOrNull(input.objectives),
          syllabus: jsonOrNull(input.syllabus),
          audience: jsonOrNull(input.audience),
          facilities: jsonOrNull(input.facilities),
          duration: input.duration,
          method: input.method,
          types: input.types,
          priceText: input.priceText,
          showPrice: input.showPrice,
          coverId: input.coverId,
          status: input.status,
          ...publish,
          seo: seoJson(input.seo),
          updatedById: userId,
          categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
        },
        include: adminInclude,
      });
      await releaseRedirectPath(tx, publicPath.training(slug), userId);
      await writeAudit(
        {
          userId,
          action: AuditAction.CREATE,
          entity: ENTITY,
          entityId: row.id,
          diff: diffFields(null, auditShape(row) ?? {}, AUDIT_FIELDS) as Prisma.InputJsonValue,
        },
        tx,
      );
      return row;
    }),
  );

  if (isPubliclyVisible(created, now)) await revalidateTags(trainingTags([created.slug]));
  return toDto(created, now);
}

export async function updateTraining(
  id: string,
  input: TrainingUpdateInput,
  userId: string,
  now = new Date(),
): Promise<TrainingDto> {
  const before = await findActive(id);
  const slugChanged = input.slug !== undefined && input.slug !== before.slug;
  if (slugChanged && input.slug) await assertSlugAvailable(slugLookup, input.slug, id);
  if (input.categoryIds) await assertActiveCategories(input.categoryIds);
  const seo = input.seo ?? parseSeo(before.seo);
  await assertImageMedia({
    coverId: input.coverId === undefined ? null : input.coverId,
    "seo.ogImageId": input.seo ? input.seo.ogImageId : null,
  });

  const showPrice = input.showPrice ?? before.showPrice;
  const priceText = input.priceText === undefined ? before.priceText : input.priceText;
  assertPrice(showPrice, priceText);

  const status = input.status ?? before.status;
  const requestedPublishedAt = input.publishedAt === undefined ? before.publishedAt : input.publishedAt;
  const publish = resolvePublish(status, requestedPublishedAt, now);
  // Sudah tayang sebelumnya dengan waktu yang sama: jangan reset penanda revalidate.
  const keepRevalidated =
    status === "PUBLISHED" &&
    before.status === "PUBLISHED" &&
    before.publishedAt?.getTime() === publish.publishedAt?.getTime() &&
    before.publishRevalidatedAt !== null;

  const data: Prisma.TrainingUncheckedUpdateInput = {
    updatedById: userId,
    status,
    publishedAt: publish.publishedAt,
    ...(keepRevalidated ? {} : { publishRevalidatedAt: publish.publishRevalidatedAt }),
  };
  if (input.title !== undefined) data.title = input.title;
  if (slugChanged) data.slug = input.slug;
  if (input.summary !== undefined) data.summary = input.summary;
  if (input.body !== undefined) data.body = jsonOrNull(input.body);
  if (input.objectives !== undefined) data.objectives = jsonOrNull(input.objectives);
  if (input.syllabus !== undefined) data.syllabus = jsonOrNull(input.syllabus);
  if (input.audience !== undefined) data.audience = jsonOrNull(input.audience);
  if (input.facilities !== undefined) data.facilities = jsonOrNull(input.facilities);
  if (input.duration !== undefined) data.duration = input.duration;
  if (input.method !== undefined) data.method = input.method;
  if (input.types !== undefined) data.types = input.types;
  if (input.priceText !== undefined) data.priceText = input.priceText;
  if (input.showPrice !== undefined) data.showPrice = input.showPrice;
  if (input.coverId !== undefined) data.coverId = input.coverId;
  if (input.seo !== undefined) data.seo = seoJson(seo);

  const updated = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      if (input.categoryIds) {
        await tx.trainingCategory.deleteMany({ where: { trainingId: id } });
        await tx.trainingCategory.createMany({
          data: input.categoryIds.map((categoryId) => ({ trainingId: id, categoryId })),
        });
      }
      const row = await tx.training.update({ where: { id }, data, include: adminInclude });
      // Redirect hanya untuk URL yang pernah tayang (pelatihan published).
      if (slugChanged && before.status === "PUBLISHED") {
        await recordSlugRedirect(tx, {
          from: publicPath.training(before.slug),
          to: publicPath.training(row.slug),
          userId,
        });
      } else if (slugChanged) {
        await releaseRedirectPath(tx, publicPath.training(row.slug), userId);
      }
      await writeAudit(
        {
          userId,
          action: AuditAction.UPDATE,
          entity: ENTITY,
          entityId: id,
          diff: diffFields(auditShape(before), auditShape(row) ?? {}, AUDIT_FIELDS) as Prisma.InputJsonValue,
        },
        tx,
      );
      return row;
    }),
  );

  await revalidateTags(trainingTags([updated.slug, slugChanged ? before.slug : null]));
  return toDto(updated, now);
}

// ===== Hapus, pulihkan, duplikasi =====

export async function deleteTraining(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.training.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { slug: row.slug } },
      tx,
    );
  });
  await revalidateTags(trainingTags([row.slug]));
}

export async function restoreTraining(id: string, input: RestoreInput, userId: string): Promise<TrainingDto> {
  const row = await getDb().training.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Pelatihan tidak ditemukan di Sampah.");
  const slug = input.slug ?? row.slug;
  await assertSlugAvailable(slugLookup, slug, id);

  const restored = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const updated = await tx.training.update({
        where: { id },
        data: { deletedAt: null, slug, updatedById: userId },
        include: adminInclude,
      });
      await releaseRedirectPath(tx, publicPath.training(slug), userId);
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
  await revalidateTags(trainingTags([restored.slug]));
  return toDto(restored);
}

export async function duplicateTraining(id: string, userId: string): Promise<TrainingDto> {
  const source = await findActive(id);
  const slug = await nextAvailableSlug(slugLookup, `${source.slug}-salinan`);
  const title = `${source.title} (salinan)`.slice(0, 200);
  const json = (value: Prisma.JsonValue | null) => jsonOrNull(value);

  const copy = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.training.create({
        data: {
          slug,
          title,
          summary: source.summary,
          body: json(source.body),
          objectives: json(source.objectives),
          syllabus: json(source.syllabus),
          audience: json(source.audience),
          facilities: json(source.facilities),
          duration: source.duration,
          method: source.method,
          types: source.types,
          priceText: source.priceText,
          showPrice: source.showPrice,
          coverId: source.coverId,
          status: "DRAFT",
          publishedAt: null,
          seo: json(source.seo),
          updatedById: userId,
          categories: {
            create: activeCategories(source).map((category) => ({ categoryId: category.id })),
          },
        },
        include: adminInclude,
      });
      await writeAudit(
        {
          userId,
          action: AuditAction.DUPLICATE,
          entity: ENTITY,
          entityId: row.id,
          diff: { sourceId: source.id, slug },
        },
        tx,
      );
      return row;
    }),
  );
  // Salinan berstatus DRAFT, jadi tidak ada halaman publik yang berubah.
  return toDto(copy);
}

// ===== Aksi massal =====

export async function bulkTrainings(
  input: TrainingBulkInput,
  userId: string,
  now = new Date(),
): Promise<{ affected: number }> {
  const db = getDb();
  const rows = await db.training.findMany({
    where: { id: { in: input.ids }, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (rows.length !== input.ids.length) {
    throw new HttpError(422, "VALIDATION_ERROR", "Sebagian pelatihan tidak ditemukan atau sudah dihapus.", {
      ids: ["Muat ulang daftar lalu pilih lagi."],
    });
  }
  const ids = rows.map((row) => row.id);
  if (input.action === "set-category") await assertActiveCategories([input.categoryId]);

  await db.$transaction(async (tx) => {
    switch (input.action) {
      case "publish":
        // Belum pernah punya waktu publish, atau dijadwalkan nanti: tayang sekarang.
        await tx.training.updateMany({
          where: { id: { in: ids }, OR: [{ publishedAt: null }, { publishedAt: { gt: now } }] },
          data: { publishedAt: now },
        });
        await tx.training.updateMany({
          where: { id: { in: ids } },
          data: { status: "PUBLISHED", publishRevalidatedAt: now, updatedById: userId },
        });
        break;
      case "unpublish":
        await tx.training.updateMany({
          where: { id: { in: ids } },
          data: { status: "DRAFT", publishRevalidatedAt: null, updatedById: userId },
        });
        break;
      case "delete":
        await tx.training.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now, updatedById: userId } });
        break;
      case "set-category":
        await tx.trainingCategory.deleteMany({ where: { trainingId: { in: ids } } });
        await tx.trainingCategory.createMany({
          data: ids.map((trainingId) => ({ trainingId, categoryId: input.categoryId })),
        });
        await tx.training.updateMany({ where: { id: { in: ids } }, data: { updatedById: userId } });
        break;
    }
    await writeAudit(
      {
        userId,
        action: AuditAction.BULK,
        entity: ENTITY,
        diff: {
          action: input.action,
          ids,
          ...(input.action === "set-category" ? { categoryId: input.categoryId } : {}),
        },
      },
      tx,
    );
  });

  await revalidateTags(trainingTags(rows.map((row) => row.slug)));
  return { affected: ids.length };
}

// ===== Pratinjau (draft mode) =====

export async function findTrainingIdBySlug(slug: string): Promise<string | null> {
  const row = await getDb().training.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
  return row?.id ?? null;
}
