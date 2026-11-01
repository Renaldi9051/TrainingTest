import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import { isRichTextEmpty, richTextSchema, type RichTextDoc } from "@/lib/rich-text";
import { assertSlugAvailable, nextAvailableSlug, slugify, type SlugLookup, withSlugConflict } from "@/lib/slug";
import type {
  ArticleBulkInput,
  ArticleCalendarQuery,
  ArticleCreateInput,
  ArticleListQuery,
  ArticleUpdateInput,
} from "@/lib/validators/article";
import type { RestoreInput, SeoInput } from "@/lib/validators/common";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { activeMediaDto, assertMediaRefs, getMediaMap, type MediaDto } from "@/services/media";
import { publicPath, recordSlugRedirect, releaseRedirectPath } from "@/services/redirect";
import { parseSeo, publicState, type TrainingPublicState, type TrainingSeo } from "@/services/training";

const ENTITY = "Article";

const AUDIT_FIELDS = [
  "title",
  "slug",
  "excerpt",
  "body",
  "authorName",
  "sourceName",
  "sourceUrl",
  "categoryId",
  "coverId",
  "status",
  "publishedAt",
  "seo",
] as const;

const adminInclude = {
  cover: true,
  category: { select: { id: true, slug: true, name: true, deletedAt: true } },
} satisfies Prisma.ArticleInclude;

type ArticleRow = Prisma.ArticleGetPayload<{ include: typeof adminInclude }>;

// Draf tanpa isi disimpan sebagai dokumen kosong (kolom body wajib).
const EMPTY_DOC: RichTextDoc = { type: "doc", content: [] };

export type ArticlePublicState = TrainingPublicState;

export type ArticleCategoryRef = { id: string; slug: string; name: string };

export type ArticleListItem = {
  id: string;
  slug: string;
  title: string;
  authorName: string;
  status: "DRAFT" | "PUBLISHED";
  publicState: ArticlePublicState;
  publishedAt: Date | null;
  // null kalau kategorinya sudah dihapus.
  category: ArticleCategoryRef | null;
  cover: MediaDto | null;
  updatedAt: Date;
  createdAt: Date;
};

export type ArticleDto = ArticleListItem & {
  excerpt: string | null;
  // null = belum ada isi.
  body: RichTextDoc | null;
  sourceName: string | null;
  sourceUrl: string | null;
  categoryId: string | null;
  coverId: string | null;
  seo: TrainingSeo;
  ogImage: MediaDto | null;
};

export type ArticleCalendarItem = Pick<
  ArticleListItem,
  "id" | "slug" | "title" | "publicState" | "category" | "authorName"
> & { publishedAt: Date };

function activeCategory(row: ArticleRow): ArticleCategoryRef | null {
  if (!row.category || row.category.deletedAt !== null) return null;
  const { id, slug, name } = row.category;
  return { id, slug, name };
}

function readBody(value: unknown): RichTextDoc | null {
  const parsed = richTextSchema.safeParse(value);
  return parsed.success && !isRichTextEmpty(parsed.data) ? parsed.data : null;
}

function toListItem(row: ArticleRow, now: Date): ArticleListItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    authorName: row.authorName,
    status: row.status,
    publicState: publicState(row, now),
    publishedAt: row.publishedAt,
    category: activeCategory(row),
    cover: activeMediaDto(row.cover),
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

async function toDto(row: ArticleRow, now = new Date()): Promise<ArticleDto> {
  const seo = parseSeo(row.seo);
  const media = await getMediaMap([seo.ogImageId]);
  return {
    ...toListItem(row, now),
    excerpt: row.excerpt,
    body: readBody(row.body),
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    categoryId: activeCategory(row)?.id ?? null,
    coverId: row.coverId,
    seo,
    ogImage: seo.ogImageId ? (media.get(seo.ogImageId) ?? null) : null,
  };
}

export const articleSlugLookup: SlugLookup = (args) => getDb().article.findFirst(args);

// ===== List, kalender, detail =====

function statusWhere(status: ArticleListQuery["status"], now: Date): Prisma.ArticleWhereInput {
  switch (status) {
    case "DRAFT":
      return { status: "DRAFT" };
    case "SCHEDULED":
      return { status: "PUBLISHED", publishedAt: { gt: now } };
    case "PUBLISHED":
      return { status: "PUBLISHED", publishedAt: { lte: now } };
    default:
      return {};
  }
}

export type ArticleStatusCounts = Record<"ALL" | ArticlePublicState, number>;

export async function listArticles(
  query: ArticleListQuery,
  now = new Date(),
): Promise<{ items: ArticleListItem[]; meta: ListMeta & { counts: ArticleStatusCounts } }> {
  const base: Prisma.ArticleWhereInput = {
    deletedAt: null,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { slug: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const where: Prisma.ArticleWhereInput = { ...base, ...statusWhere(query.status, now) };
  const db = getDb();
  const [rows, total, draft, scheduled, published] = await Promise.all([
    db.article.findMany({
      where,
      include: adminInclude,
      orderBy: [
        // publishedAt bisa null (draf): taruh di akhir.
        query.sort.field === "publishedAt"
          ? { publishedAt: { sort: query.sort.direction, nulls: "last" } }
          : { [query.sort.field]: query.sort.direction },
        { id: "asc" },
      ],
      ...pagination(query.page, query.pageSize),
    }),
    db.article.count({ where }),
    // Jumlah per tab status (tanpa filter status, dengan pencarian & kategori yang sama).
    db.article.count({ where: { ...base, ...statusWhere("DRAFT", now) } }),
    db.article.count({ where: { ...base, ...statusWhere("SCHEDULED", now) } }),
    db.article.count({ where: { ...base, ...statusWhere("PUBLISHED", now) } }),
  ]);
  return {
    items: rows.map((row) => toListItem(row, now)),
    meta: {
      ...listMeta(query.page, query.pageSize, total),
      counts: { ALL: draft + scheduled + published, DRAFT: draft, SCHEDULED: scheduled, PUBLISHED: published },
    },
  };
}

// Batas aman jumlah artikel per bulan di kalender (tanpa paginasi).
const CALENDAR_LIMIT = 500;

// Artikel tayang & terjadwal yang waktu publish-nya jatuh di bulan itu (WIB).
export async function listArticleCalendar(query: ArticleCalendarQuery, now = new Date()): Promise<ArticleCalendarItem[]> {
  const [year, month] = query.month.split("-").map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const start = new Date(`${query.month}-01T00:00:00+07:00`);
  const end = new Date(`${nextMonth}-01T00:00:00+07:00`);
  const rows = await getDb().article.findMany({
    where: { deletedAt: null, status: "PUBLISHED", publishedAt: { gte: start, lt: end } },
    include: adminInclude,
    orderBy: [{ publishedAt: "asc" }, { id: "asc" }],
    take: CALENDAR_LIMIT,
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    authorName: row.authorName,
    publicState: publicState(row, now),
    category: activeCategory(row),
    // Filter publishedAt di atas menjamin terisi.
    publishedAt: row.publishedAt ?? row.createdAt,
  }));
}

async function findActive(id: string): Promise<ArticleRow> {
  const row = await getDb().article.findFirst({ where: { id, deletedAt: null }, include: adminInclude });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Artikel tidak ditemukan.");
  return row;
}

export async function getArticle(id: string): Promise<ArticleDto> {
  return toDto(await findActive(id));
}

export async function findArticleIdBySlug(slug: string): Promise<string | null> {
  const row = await getDb().article.findFirst({ where: { slug, deletedAt: null }, select: { id: true } });
  return row?.id ?? null;
}

// ===== Validasi =====

async function assertActiveCategory(id: string): Promise<void> {
  const found = await getDb().articleCategory.count({ where: { id, deletedAt: null } });
  if (found === 0) {
    throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid.", {
      categoryId: ["Kategori tidak ditemukan atau sudah dihapus."],
    });
  }
}

const BODY_REQUIRED = "Isi artikel wajib diisi sebelum ditayangkan.";

// Tayang (termasuk terjadwal) butuh isi artikel; draf boleh kosong.
function assertPublishable(status: "DRAFT" | "PUBLISHED", body: unknown): void {
  if (status === "PUBLISHED" && readBody(body) === null) {
    throw new HttpError(422, "NOT_PUBLISHABLE", "Konten belum lengkap untuk ditayangkan.", { body: [BODY_REQUIRED] });
  }
}

// Sama dengan pelatihan: publish tanpa waktu = sekarang; waktu lewat langsung di-revalidate,
// waktu di masa depan ditangani scheduler (publishRevalidatedAt null).
function resolvePublish(
  status: "DRAFT" | "PUBLISHED",
  publishedAt: Date | null,
  now: Date,
): { publishedAt: Date | null; publishRevalidatedAt: Date | null } {
  if (status !== "PUBLISHED") return { publishedAt, publishRevalidatedAt: null };
  const at = publishedAt ?? now;
  return { publishedAt: at, publishRevalidatedAt: at.getTime() <= now.getTime() ? now : null };
}

function seoJson(seo: SeoInput): Prisma.InputJsonValue {
  return { title: seo.title, description: seo.description, ogImageId: seo.ogImageId };
}

// Halaman publik berubah kalau artikel tayang sebelum ATAU sesudah mutasi.
function isVisible(row: { deletedAt: Date | null; status: string; publishedAt: Date | null }, now: Date): boolean {
  return row.deletedAt === null && publicState(row, now) === "PUBLISHED";
}

// ===== Create / update =====

export async function createArticle(input: ArticleCreateInput, userId: string, now = new Date()): Promise<ArticleDto> {
  assertPublishable(input.status, input.body);
  await assertActiveCategory(input.categoryId);
  await assertMediaRefs([
    { field: "coverId", mediaId: input.coverId, kind: "image", requireAlt: true },
    { field: "seo.ogImageId", mediaId: input.seo.ogImageId, kind: "image" },
  ]);

  const slug = input.slug ?? (await nextAvailableSlug(articleSlugLookup, slugify(input.title) || "artikel"));
  if (input.slug) await assertSlugAvailable(articleSlugLookup, slug);
  const publish = resolvePublish(input.status, input.publishedAt, now);

  const created = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.article.create({
        data: {
          slug,
          title: input.title,
          excerpt: input.excerpt,
          body: (input.body ?? EMPTY_DOC) as Prisma.InputJsonValue,
          authorName: input.authorName,
          sourceName: input.sourceName,
          sourceUrl: input.sourceUrl,
          categoryId: input.categoryId,
          coverId: input.coverId,
          status: input.status,
          ...publish,
          seo: seoJson(input.seo),
          updatedById: userId,
        },
        include: adminInclude,
      });
      await releaseRedirectPath(tx, publicPath.article(slug), userId);
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
    }),
  );

  if (isVisible(created, now)) await revalidateEntity({ entity: "Article", slugs: [created.slug] });
  return toDto(created, now);
}

export async function updateArticle(
  id: string,
  input: ArticleUpdateInput,
  userId: string,
  now = new Date(),
): Promise<ArticleDto> {
  const before = await findActive(id);
  const slugChanged = input.slug !== undefined && input.slug !== before.slug;
  if (slugChanged && input.slug) await assertSlugAvailable(articleSlugLookup, input.slug, id);
  if (input.categoryId !== undefined) await assertActiveCategory(input.categoryId);
  await assertMediaRefs([
    { field: "coverId", mediaId: input.coverId, kind: "image", requireAlt: true },
    { field: "seo.ogImageId", mediaId: input.seo?.ogImageId, kind: "image" },
  ]);

  const status = input.status ?? before.status;
  assertPublishable(status, input.body === undefined ? before.body : input.body);
  const requestedPublishedAt = input.publishedAt === undefined ? before.publishedAt : input.publishedAt;
  const publish = resolvePublish(status, requestedPublishedAt, now);
  // Sudah tayang sebelumnya dengan waktu yang sama: jangan reset penanda revalidate.
  const keepRevalidated =
    status === "PUBLISHED" &&
    before.status === "PUBLISHED" &&
    before.publishedAt?.getTime() === publish.publishedAt?.getTime() &&
    before.publishRevalidatedAt !== null;

  const data: Prisma.ArticleUncheckedUpdateInput = {
    updatedById: userId,
    status,
    publishedAt: publish.publishedAt,
    ...(keepRevalidated ? {} : { publishRevalidatedAt: publish.publishRevalidatedAt }),
  };
  if (input.title !== undefined) data.title = input.title;
  if (slugChanged) data.slug = input.slug;
  if (input.excerpt !== undefined) data.excerpt = input.excerpt;
  if (input.body !== undefined) data.body = (input.body ?? EMPTY_DOC) as Prisma.InputJsonValue;
  if (input.authorName !== undefined) data.authorName = input.authorName;
  if (input.sourceName !== undefined) data.sourceName = input.sourceName;
  if (input.sourceUrl !== undefined) data.sourceUrl = input.sourceUrl;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.coverId !== undefined) data.coverId = input.coverId;
  if (input.seo !== undefined) data.seo = seoJson(input.seo);

  const updated = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.article.update({ where: { id }, data, include: adminInclude });
      // Redirect hanya untuk URL yang pernah tayang.
      if (slugChanged && isVisible(before, now)) {
        await recordSlugRedirect(tx, {
          from: publicPath.article(before.slug),
          to: publicPath.article(row.slug),
          userId,
        });
      } else if (slugChanged) {
        await releaseRedirectPath(tx, publicPath.article(row.slug), userId);
      }
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
    }),
  );

  if (isVisible(before, now) || isVisible(updated, now)) {
    await revalidateEntity({ entity: "Article", slugs: [updated.slug, slugChanged ? before.slug : null] });
  }
  return toDto(updated, now);
}

// ===== Hapus & pulihkan =====

export async function deleteArticle(id: string, userId: string, now = new Date()): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.article.update({ where: { id }, data: { deletedAt: now, updatedById: userId } });
    await writeAudit({ userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { slug: row.slug } }, tx);
  });
  if (isVisible(row, now)) await revalidateEntity({ entity: "Article", slugs: [row.slug] });
}

export async function restoreArticle(id: string, input: RestoreInput, userId: string, now = new Date()): Promise<ArticleDto> {
  const row = await getDb().article.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Artikel tidak ditemukan di Sampah.");
  const slug = input.slug ?? row.slug;
  await assertSlugAvailable(articleSlugLookup, slug, id);

  const restored = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const updated = await tx.article.update({
        where: { id },
        data: { deletedAt: null, slug, updatedById: userId },
        include: adminInclude,
      });
      await releaseRedirectPath(tx, publicPath.article(slug), userId);
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
  if (isVisible(restored, now)) await revalidateEntity({ entity: "Article", slugs: [restored.slug] });
  return toDto(restored, now);
}

// ===== Aksi massal (juga dipakai tombol Publish / Tarik / Hapus per baris) =====

export type ArticleBulkSkipped = { id: string; title: string; reason: string };
export type ArticleBulkResult = { affected: number; skipped: ArticleBulkSkipped[] };

export async function bulkArticles(input: ArticleBulkInput, userId: string, now = new Date()): Promise<ArticleBulkResult> {
  const db = getDb();
  const rows = await db.article.findMany({
    where: { id: { in: input.ids }, deletedAt: null },
    select: { id: true, slug: true, title: true, body: true },
  });
  if (rows.length !== input.ids.length) {
    throw new HttpError(422, "VALIDATION_ERROR", "Sebagian artikel tidak ditemukan atau sudah dihapus.", {
      ids: ["Muat ulang daftar lalu pilih lagi."],
    });
  }

  // Publish: artikel tanpa isi dilewati (bukan menggagalkan semuanya).
  const skipped: ArticleBulkSkipped[] =
    input.action === "publish"
      ? rows.flatMap((row) => (readBody(row.body) === null ? [{ id: row.id, title: row.title, reason: BODY_REQUIRED }] : []))
      : [];
  const skippedIds = new Set(skipped.map((item) => item.id));
  const targets = rows.filter((row) => !skippedIds.has(row.id));
  const ids = targets.map((row) => row.id);
  if (ids.length === 0) return { affected: 0, skipped };

  await db.$transaction(async (tx) => {
    switch (input.action) {
      case "publish":
        // Belum punya waktu publish, atau terjadwal nanti: tayang sekarang.
        await tx.article.updateMany({
          where: { id: { in: ids }, OR: [{ publishedAt: null }, { publishedAt: { gt: now } }] },
          data: { publishedAt: now },
        });
        await tx.article.updateMany({
          where: { id: { in: ids } },
          data: { status: "PUBLISHED", publishRevalidatedAt: now, updatedById: userId },
        });
        break;
      case "unpublish":
        await tx.article.updateMany({
          where: { id: { in: ids } },
          data: { status: "DRAFT", publishRevalidatedAt: null, updatedById: userId },
        });
        break;
      case "delete":
        await tx.article.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now, updatedById: userId } });
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
          ...(skipped.length > 0 ? { skipped: skipped.map((item) => item.id) } : {}),
        },
      },
      tx,
    );
  });

  await revalidateEntity({ entity: "Article", slugs: targets.map((row) => row.slug) });
  return { affected: ids.length, skipped };
}
