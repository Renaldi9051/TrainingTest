import type { Page, PageKind, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import { renderRichText } from "@/lib/rich-text";
import {
  assertSlugAvailable,
  nextAvailableSlug,
  slugify,
  type SlugLookup,
  withSlugConflict,
} from "@/lib/slug";
import type { RestoreInput, SeoInput } from "@/lib/validators/common";
import {
  pageSlugIssue,
  RESERVED_PAGE_SLUGS,
  type PageCreateInput,
  type PageListQuery,
  type PageUpdateInput,
} from "@/lib/validators/page";
import { pageBlockMediaRefs, parseStoredBlocks, type PageBlock } from "@/lib/validators/page-blocks";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { assertMediaRefs, getMediaMap, toPublicImage, type MediaDto, type PublicImage } from "@/services/media";
import { publicPath, recordSlugRedirect, releaseRedirectPath } from "@/services/redirect";
import { resolveServiceSelections, type PublicServiceCard } from "@/services/service";
import { parseSeo, type TrainingSeo } from "@/services/training";

const ENTITY = "Page";
const AUDIT_FIELDS = ["slug", "title", "status", "blocks", "seo"] as const;

// ===== DTO admin =====

export type PageListItem = {
  id: string;
  kind: PageKind;
  slug: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  blockCount: number;
  updatedAt: Date;
};

export type PageDto = PageListItem & {
  blocks: PageBlock[];
  seo: TrainingSeo;
  ogImage: MediaDto | null;
  // Media yang dirujuk blok (gambar, PDF), untuk pratinjau di editor tanpa fetch ulang.
  media: Record<string, MediaDto>;
  publishedAt: Date | null;
  createdAt: Date;
};

function toListItem(row: Page): PageListItem {
  return {
    id: row.id,
    kind: row.kind,
    slug: row.slug,
    title: row.title,
    status: row.status,
    blockCount: Array.isArray(row.blocks) ? row.blocks.length : 0,
    updatedAt: row.updatedAt,
  };
}

async function toDto(row: Page): Promise<PageDto> {
  const blocks = parseStoredBlocks(row.blocks);
  const seo = parseSeo(row.seo);
  const media = await getMediaMap([seo.ogImageId, ...pageBlockMediaRefs(blocks).map((ref) => ref.mediaId)]);
  return {
    ...toListItem(row),
    blocks,
    seo,
    ogImage: seo.ogImageId ? (media.get(seo.ogImageId) ?? null) : null,
    media: Object.fromEntries(media),
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
  };
}

function seoJson(seo: SeoInput): Prisma.InputJsonValue {
  return { title: seo.title, description: seo.description, ogImageId: seo.ogImageId };
}

function auditShape(row: Page) {
  return { slug: row.slug, title: row.title, status: row.status, blocks: row.blocks, seo: row.seo };
}

// Slug yang bentrok dengan route situs selalu dianggap terpakai (slug otomatis & cek realtime).
export const pageSlugLookup: SlugLookup = async (args) =>
  RESERVED_PAGE_SLUGS.has(args.where.slug) ? { id: "reserved" } : getDb().page.findFirst(args);

function slugError(message: string): HttpError {
  return new HttpError(422, "VALIDATION_ERROR", message, { slug: [message] });
}

function assertSlugAllowed(slug: string, kind: PageKind): void {
  const issue = pageSlugIssue(slug, kind);
  if (issue) throw slugError(issue);
}

// Media di blok + gambar OG: jenis file benar dan gambar konten punya alt. Error per field form.
async function assertPageMedia(blocks: PageBlock[] | undefined, seo: SeoInput | undefined): Promise<void> {
  await assertMediaRefs([
    ...pageBlockMediaRefs(blocks ?? []).map((ref) => ({
      field: `blocks.${ref.path}`,
      mediaId: ref.mediaId,
      kind: ref.kind,
      requireAlt: ref.requireAlt,
    })),
    { field: "seo.ogImageId", mediaId: seo?.ogImageId, kind: "image" as const },
  ]);
}

async function findActive(id: string): Promise<Page> {
  const row = await getDb().page.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Halaman tidak ditemukan.");
  return row;
}

// ===== Admin =====

export async function listPages(query: PageListQuery): Promise<{ items: PageListItem[]; meta: ListMeta }> {
  const where: Prisma.PageWhereInput = {
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
    db.page.findMany({
      where,
      // Halaman sistem (PROFILE, urutan enum terakhir) selalu di atas.
      orderBy: [{ kind: "desc" }, { [query.sort.field]: query.sort.direction }, { title: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.page.count({ where }),
  ]);
  return { items: rows.map(toListItem), meta: listMeta(query.page, query.pageSize, total) };
}

export async function getPage(id: string): Promise<PageDto> {
  return toDto(await findActive(id));
}

function publishedAtFor(status: "DRAFT" | "PUBLISHED", current: Date | null, now: Date): Date | null {
  return status === "PUBLISHED" ? (current ?? now) : current;
}

// Lewat API hanya halaman STANDARD; halaman PROFILE dibuat seed.
export async function createPage(input: PageCreateInput, userId: string, now = new Date()): Promise<PageDto> {
  if (input.slug) assertSlugAllowed(input.slug, "STANDARD");
  await assertPageMedia(input.blocks, input.seo);
  const slug = input.slug ?? (await nextAvailableSlug(pageSlugLookup, slugify(input.title) || "halaman"));
  if (input.slug) await assertSlugAvailable(pageSlugLookup, slug);

  const created = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.page.create({
        data: {
          kind: "STANDARD",
          slug,
          title: input.title,
          blocks: input.blocks as Prisma.InputJsonValue,
          status: input.status,
          publishedAt: publishedAtFor(input.status, null, now),
          seo: seoJson(input.seo),
          updatedById: userId,
        },
      });
      await releaseRedirectPath(tx, publicPath.page(slug), userId);
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

  if (created.status === "PUBLISHED") await revalidateEntity({ entity: "Page", slugs: [created.slug] });
  return toDto(created);
}

export async function updatePage(
  id: string,
  input: PageUpdateInput,
  userId: string,
  now = new Date(),
): Promise<PageDto> {
  const before = await findActive(id);
  const slugChanged = input.slug !== undefined && input.slug !== before.slug;
  // Halaman profil: slug lain ditolak 422 (bukan diabaikan). Halaman biasa: slug route ditolak.
  if (slugChanged && input.slug) {
    assertSlugAllowed(input.slug, before.kind);
    await assertSlugAvailable(pageSlugLookup, input.slug, id);
  }
  await assertPageMedia(input.blocks, input.seo);

  const status = input.status ?? before.status;
  const data: Prisma.PageUncheckedUpdateInput = {
    updatedById: userId,
    status,
    publishedAt: publishedAtFor(status, before.publishedAt, now),
  };
  if (input.title !== undefined) data.title = input.title;
  if (slugChanged) data.slug = input.slug;
  if (input.blocks !== undefined) data.blocks = input.blocks as Prisma.InputJsonValue;
  if (input.seo !== undefined) data.seo = seoJson(input.seo);

  const updated = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const row = await tx.page.update({ where: { id }, data });
      // Redirect hanya untuk URL yang pernah tayang; recordSlugRedirect meratakan rantai.
      if (slugChanged && before.status === "PUBLISHED") {
        await recordSlugRedirect(tx, {
          from: publicPath.page(before.slug),
          to: publicPath.page(row.slug),
          userId,
        });
      } else if (slugChanged) {
        await releaseRedirectPath(tx, publicPath.page(row.slug), userId);
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

  await revalidateEntity({ entity: "Page", slugs: [updated.slug, slugChanged ? before.slug : null] });
  return toDto(updated);
}

export async function deletePage(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  if (row.kind === "PROFILE") {
    throw new HttpError(409, "SYSTEM_PAGE", "Halaman profil adalah halaman sistem dan tidak bisa dihapus.");
  }
  await getDb().$transaction(async (tx) => {
    await tx.page.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { slug: row.slug } },
      tx,
    );
  });
  await revalidateEntity({ entity: "Page", slugs: [row.slug] });
}

// Pulihkan dari Sampah. Slug lama dipakai halaman lain / route situs: 409/422, kirim slug baru.
export async function restorePage(id: string, input: RestoreInput, userId: string): Promise<PageDto> {
  const row = await getDb().page.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Halaman tidak ditemukan di Sampah.");
  const slug = input.slug ?? row.slug;
  assertSlugAllowed(slug, row.kind);
  await assertSlugAvailable(pageSlugLookup, slug, id);

  const restored = await withSlugConflict(() =>
    getDb().$transaction(async (tx) => {
      const updated = await tx.page.update({ where: { id }, data: { deletedAt: null, slug, updatedById: userId } });
      await releaseRedirectPath(tx, publicPath.page(slug), userId);
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
  await revalidateEntity({ entity: "Page", slugs: [restored.slug] });
  return toDto(restored);
}

// ===== Publik =====

type HeadingFields = { eyebrow: string; heading: string };

export type PublicPageBlock =
  | ({ id: string; type: "RICH_TEXT"; bodyHtml: string } & HeadingFields)
  | { id: string; type: "VISION_MISSION"; eyebrow: string; vision: string; mission: string[]; motto: string }
  | ({
      id: string;
      type: "FEATURES";
      items: { title: string; description: string; icon: string | null }[];
    } & HeadingFields)
  | ({ id: string; type: "LIST"; style: "bullet" | "chips"; items: string[] } & HeadingFields)
  | ({ id: string; type: "SERVICES"; intro: string; items: PublicServiceCard[] } & HeadingFields)
  | { id: string; type: "IMAGE"; image: PublicImage; caption: string }
  | ({
      id: string;
      type: "DOWNLOAD";
      description: string;
      label: string;
      file: { url: string; size: number; mime: string };
    } & HeadingFields);

export type PublicPage = {
  kind: PageKind;
  slug: string;
  title: string;
  blocks: PublicPageBlock[];
  seo: { title: string; description: string; ogImage: PublicImage | null };
  updatedAt: Date;
};

export const publicPageWhere = { deletedAt: null, status: "PUBLISHED" } satisfies Prisma.PageWhereInput;

// Blok tersimpan -> blok tampil: rich text dirender lewat allowlist, layanan di-resolve (id yang
// dihapus/draft tersaring), blok gambar/unduhan tanpa media aktif yang sesuai dilewati.
export async function resolvePageBlocks(stored: unknown): Promise<PublicPageBlock[]> {
  const blocks = parseStoredBlocks(stored);
  const serviceBlocks = blocks.filter((block) => block.type === "SERVICES");
  const [media, services] = await Promise.all([
    getMediaMap(pageBlockMediaRefs(blocks).map((ref) => ref.mediaId)),
    resolveServiceSelections(serviceBlocks),
  ]);
  const servicesByBlock = new Map(serviceBlocks.map((block, index) => [block.id, services[index] ?? []]));

  return blocks.flatMap((block): PublicPageBlock[] => {
    switch (block.type) {
      case "RICH_TEXT": {
        const bodyHtml = renderRichText(block.body);
        return bodyHtml
          ? [{ id: block.id, type: block.type, eyebrow: block.eyebrow, heading: block.heading, bodyHtml }]
          : [];
      }
      case "VISION_MISSION":
        return [
          {
            id: block.id,
            type: block.type,
            eyebrow: block.eyebrow,
            vision: block.vision,
            mission: block.mission,
            motto: block.motto,
          },
        ];
      case "FEATURES":
        return [{ id: block.id, type: block.type, eyebrow: block.eyebrow, heading: block.heading, items: block.items }];
      case "LIST":
        return [
          {
            id: block.id,
            type: block.type,
            eyebrow: block.eyebrow,
            heading: block.heading,
            style: block.style,
            items: block.items,
          },
        ];
      case "SERVICES":
        return [
          {
            id: block.id,
            type: block.type,
            eyebrow: block.eyebrow,
            heading: block.heading,
            intro: block.intro,
            items: servicesByBlock.get(block.id) ?? [],
          },
        ];
      case "IMAGE": {
        const image = media.get(block.image.mediaId);
        const publicImage = image?.mime.startsWith("image/") ? toPublicImage(image) : null;
        return publicImage ? [{ id: block.id, type: block.type, image: publicImage, caption: block.caption }] : [];
      }
      case "DOWNLOAD": {
        const file = block.file ? media.get(block.file.mediaId) : undefined;
        if (!file || file.mime !== "application/pdf") return [];
        return [
          {
            id: block.id,
            type: block.type,
            eyebrow: block.eyebrow,
            heading: block.heading,
            description: block.description,
            label: block.label,
            file: { url: file.url, size: file.size, mime: file.mime },
          },
        ];
      }
    }
  });
}

async function toPublicPage(row: Page): Promise<PublicPage> {
  const seo = parseSeo(row.seo);
  const [blocks, media] = await Promise.all([resolvePageBlocks(row.blocks), getMediaMap([seo.ogImageId])]);
  return {
    kind: row.kind,
    slug: row.slug,
    title: row.title,
    blocks,
    seo: {
      title: seo.title,
      description: seo.description,
      ogImage: toPublicImage(seo.ogImageId ? media.get(seo.ogImageId) : null),
    },
    updatedAt: row.updatedAt,
  };
}

// Daftar halaman statis untuk generateStaticParams /[slug]. Halaman PROFILE tidak ikut (punya
// route sendiri /profil).
export async function listPublicPages(): Promise<{ slug: string; title: string }[]> {
  return getDb().page.findMany({
    where: { ...publicPageWhere, kind: "STANDARD" },
    select: { slug: true, title: true },
    orderBy: [{ title: "asc" }],
  });
}

export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  const row = await getDb().page.findFirst({ where: { slug, ...publicPageWhere } });
  return row ? toPublicPage(row) : null;
}

// Pratinjau admin (draft mode): bentuk sama dengan publik, termasuk draft.
export async function getPagePreview(slug: string): Promise<PublicPage | null> {
  const row = await getDb().page.findFirst({ where: { slug, deletedAt: null } });
  return row ? toPublicPage(row) : null;
}
