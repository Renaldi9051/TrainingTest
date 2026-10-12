import type { Media, Prisma, Testimonial } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateEntity } from "@/lib/revalidate-map";
import type { OptionsQuery } from "@/lib/validators/options";
import type {
  TestimonialCreateInput,
  TestimonialListQuery,
  TestimonialUpdateInput,
} from "@/lib/validators/testimonial";
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

const ENTITY = "Testimonial";
const AUDIT_FIELDS = ["name", "role", "company", "quote", "photoId"] as const;

type TestimonialRow = Testimonial & { photo: Media | null };
const include = { photo: true } satisfies Prisma.TestimonialInclude;

export type TestimonialDto = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  quote: string;
  photoId: string | null;
  photo: MediaDto | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: TestimonialRow): TestimonialDto {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    company: row.company,
    quote: row.quote,
    photoId: row.photoId,
    photo: activeMediaDto(row.photo),
    order: row.order,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findActive(id: string): Promise<TestimonialRow> {
  const row = await getDb().testimonial.findFirst({ where: { id, deletedAt: null }, include });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Testimoni tidak ditemukan.");
  return row;
}

const searchWhere = (q: string | undefined): Prisma.TestimonialWhereInput =>
  q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { company: { contains: q, mode: "insensitive" } },
          { quote: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

export async function listTestimonials(
  query: TestimonialListQuery,
): Promise<{ items: TestimonialDto[]; meta: ListMeta }> {
  const where: Prisma.TestimonialWhereInput = { deletedAt: null, ...searchWhere(query.q) };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.testimonial.findMany({
      where,
      include,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { name: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.testimonial.count({ where }),
  ]);
  return { items: rows.map(toDto), meta: listMeta(query.page, query.pageSize, total) };
}

export async function listTestimonialOptions(query: OptionsQuery): Promise<OptionItem[]> {
  const db = getDb();
  const rows = await db.testimonial.findMany({
    where: { deletedAt: null, ...searchWhere(query.q) },
    include,
    orderBy: [{ order: "asc" }, { name: "asc" }],
    take: query.limit,
  });
  const withIds = await withSelected(rows, query.ids, (ids) =>
    db.testimonial.findMany({ where: { id: { in: ids }, deletedAt: null }, include }),
  );
  return withIds.map((row) => ({
    id: row.id,
    label: row.name,
    sublabel: row.company,
    imageUrl: thumbnailUrl(row.photo),
  }));
}

export async function getTestimonial(id: string): Promise<TestimonialDto> {
  return toDto(await findActive(id));
}

export async function createTestimonial(input: TestimonialCreateInput, userId: string): Promise<TestimonialDto> {
  await assertImageMedia({ photoId: input.photoId });
  const order = await nextOrder(getDb().testimonial);
  const created = await getDb().$transaction(async (tx) => {
    const row = await tx.testimonial.create({
      data: {
        name: input.name,
        role: input.role,
        company: input.company,
        quote: input.quote,
        photoId: input.photoId,
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
  await revalidateEntity({ entity: "Testimonial" });
  return toDto(created);
}

export async function updateTestimonial(
  id: string,
  input: TestimonialUpdateInput,
  userId: string,
): Promise<TestimonialDto> {
  const before = await findActive(id);
  await assertImageMedia({ photoId: input.photoId ?? null });
  const data: Prisma.TestimonialUncheckedUpdateInput = { updatedById: userId };
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.company !== undefined) data.company = input.company;
  if (input.quote !== undefined) data.quote = input.quote;
  if (input.photoId !== undefined) data.photoId = input.photoId;

  const updated = await getDb().$transaction(async (tx) => {
    const row = await tx.testimonial.update({ where: { id }, data, include });
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
  await revalidateEntity({ entity: "Testimonial" });
  return toDto(updated);
}

export async function deleteTestimonial(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.testimonial.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { name: row.name } },
      tx,
    );
  });
  await revalidateEntity({ entity: "Testimonial" });
}

export async function restoreTestimonial(id: string, userId: string): Promise<TestimonialDto> {
  const row = await getDb().testimonial.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Testimoni tidak ditemukan di Sampah.");
  const order = await nextOrder(getDb().testimonial);
  const restored = await getDb().$transaction(async (tx) => {
    const updated = await tx.testimonial.update({
      where: { id },
      data: { deletedAt: null, order, updatedById: userId },
      include,
    });
    await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
    return updated;
  });
  await revalidateEntity({ entity: "Testimonial" });
  return toDto(restored);
}

// ===== Publik =====

export type PublicTestimonial = {
  name: string;
  role: string | null;
  company: string | null;
  quote: string;
  photo: PublicImage | null;
};

export function toPublicTestimonial(row: TestimonialRow): PublicTestimonial {
  return {
    name: row.name,
    role: row.role,
    company: row.company,
    quote: row.quote,
    photo: toPublicImage(activeMediaDto(row.photo)),
  };
}

export async function listPublicTestimonials(): Promise<PublicTestimonial[]> {
  const rows = await getDb().testimonial.findMany({
    where: { deletedAt: null },
    include,
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(toPublicTestimonial);
}
