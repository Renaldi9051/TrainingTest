import type { Prisma, Schedule } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { revalidateTags, RevalidateTag, tags } from "@/lib/revalidate";
import { appToday, monthRange, toDateString } from "@/lib/time";
import {
  END_AFTER_START_MESSAGE,
  type PublicScheduleQuery,
  type ScheduleCreateInput,
  type ScheduleListQuery,
  type ScheduleUpdateInput,
} from "@/lib/validators/schedule";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { scheduleDisplayStatus, type PublicScheduleStatus } from "@/services/schedule-status";
import { publicTrainingWhere } from "@/services/training-visibility";

const ENTITY = "Schedule";
const FIELDS = ["trainingId", "startDate", "endDate", "city", "venue", "method", "price", "status"] as const;

const adminInclude = {
  training: { select: { id: true, slug: true, title: true, deletedAt: true } },
} satisfies Prisma.ScheduleInclude;

type ScheduleRow = Prisma.ScheduleGetPayload<{ include: typeof adminInclude }>;

export type ScheduleDto = {
  id: string;
  training: { id: string; slug: string; title: string };
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: string;
  price: number | null;
  status: PublicScheduleStatus;
  // Status yang tampil di publik (SELESAI otomatis kalau tanggal selesai sudah lewat).
  displayStatus: PublicScheduleStatus;
  updatedAt: Date;
};

const toDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

function toDto(row: ScheduleRow, today: Date): ScheduleDto {
  return {
    id: row.id,
    training: { id: row.training.id, slug: row.training.slug, title: row.training.title },
    startDate: toDateString(row.startDate),
    endDate: toDateString(row.endDate),
    city: row.city,
    venue: row.venue,
    method: row.method,
    price: row.price,
    status: row.status,
    displayStatus: scheduleDisplayStatus(row, today),
    updatedAt: row.updatedAt,
  };
}

// Nilai audit dalam bentuk string tanggal supaya diff tidak berubah karena zona waktu.
function auditShape(row: Schedule | null) {
  if (!row) return null;
  return { ...row, startDate: toDateString(row.startDate), endDate: toDateString(row.endDate) };
}

// ===== Admin =====

export async function listSchedules(
  query: ScheduleListQuery,
  now = new Date(),
): Promise<{ items: ScheduleDto[]; meta: ListMeta }> {
  const today = appToday(now);
  const where: Prisma.ScheduleWhereInput = {
    deletedAt: null,
    training: { deletedAt: null },
    ...(query.trainingId ? { trainingId: query.trainingId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.month ? { startDate: { gte: monthRange(query.month).start, lt: monthRange(query.month).end } } : {}),
    ...(query.period === "upcoming" ? { endDate: { gte: today } } : {}),
    ...(query.period === "past" ? { endDate: { lt: today } } : {}),
    ...(query.q
      ? {
          OR: [
            { city: { contains: query.q, mode: "insensitive" } },
            { venue: { contains: query.q, mode: "insensitive" } },
            { training: { title: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.schedule.findMany({
      where,
      include: adminInclude,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { id: "asc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.schedule.count({ where }),
  ]);
  return { items: rows.map((row) => toDto(row, today)), meta: listMeta(query.page, query.pageSize, total) };
}

async function findActive(id: string): Promise<ScheduleRow> {
  const row = await getDb().schedule.findFirst({ where: { id, deletedAt: null }, include: adminInclude });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Jadwal tidak ditemukan.");
  return row;
}

export async function getSchedule(id: string, now = new Date()): Promise<ScheduleDto> {
  return toDto(await findActive(id), appToday(now));
}

async function findTraining(trainingId: string) {
  const training = await getDb().training.findFirst({
    where: { id: trainingId, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!training) {
    throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid.", {
      trainingId: ["Pelatihan tidak ditemukan atau sudah dihapus."],
    });
  }
  return training;
}

function scheduleTags(...trainingSlugs: (string | null | undefined)[]): string[] {
  return tags(
    RevalidateTag.SCHEDULES,
    ...trainingSlugs.map((slug) => (slug ? RevalidateTag.training(slug) : null)),
  );
}

export async function createSchedule(input: ScheduleCreateInput, userId: string): Promise<ScheduleDto> {
  const training = await findTraining(input.trainingId);
  const created = await getDb().$transaction(async (tx) => {
    const row = await tx.schedule.create({
      data: {
        trainingId: input.trainingId,
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
        city: input.city,
        venue: input.venue,
        method: input.method,
        price: input.price,
        status: input.status,
        updatedById: userId,
      },
      include: adminInclude,
    });
    await writeAudit(
      {
        userId,
        action: AuditAction.CREATE,
        entity: ENTITY,
        entityId: row.id,
        diff: diffFields(null, auditShape(row) ?? {}, FIELDS) as Prisma.InputJsonValue,
      },
      tx,
    );
    return row;
  });
  await revalidateTags(scheduleTags(training.slug));
  return toDto(created, appToday());
}

export async function updateSchedule(id: string, input: ScheduleUpdateInput, userId: string): Promise<ScheduleDto> {
  const before = await findActive(id);
  const training = input.trainingId ? await findTraining(input.trainingId) : before.training;
  const startDate = input.startDate ?? toDateString(before.startDate);
  const endDate = input.endDate ?? toDateString(before.endDate);
  if (endDate < startDate) {
    throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid.", { endDate: [END_AFTER_START_MESSAGE] });
  }

  const data: Prisma.ScheduleUncheckedUpdateInput = { updatedById: userId };
  if (input.trainingId !== undefined) data.trainingId = input.trainingId;
  if (input.startDate !== undefined) data.startDate = toDate(input.startDate);
  if (input.endDate !== undefined) data.endDate = toDate(input.endDate);
  if (input.city !== undefined) data.city = input.city;
  if (input.venue !== undefined) data.venue = input.venue;
  if (input.method !== undefined) data.method = input.method;
  if (input.price !== undefined) data.price = input.price;
  if (input.status !== undefined) data.status = input.status;

  const updated = await getDb().$transaction(async (tx) => {
    const row = await tx.schedule.update({ where: { id }, data, include: adminInclude });
    await writeAudit(
      {
        userId,
        action: AuditAction.UPDATE,
        entity: ENTITY,
        entityId: id,
        diff: diffFields(auditShape(before), auditShape(row) ?? {}, FIELDS) as Prisma.InputJsonValue,
      },
      tx,
    );
    return row;
  });
  await revalidateTags(scheduleTags(training.slug, before.training.slug));
  return toDto(updated, appToday());
}

export async function deleteSchedule(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.schedule.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit({ userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id }, tx);
  });
  await revalidateTags(scheduleTags(row.training.slug));
}

export async function restoreSchedule(id: string, userId: string): Promise<ScheduleDto> {
  const row = await getDb().schedule.findFirst({ where: { id, deletedAt: { not: null } }, include: adminInclude });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Jadwal tidak ditemukan di Sampah.");
  if (row.training.deletedAt) {
    throw new HttpError(409, "TRAINING_DELETED", "Pulihkan pelatihannya dulu sebelum memulihkan jadwal ini.");
  }
  const restored = await getDb().$transaction(async (tx) => {
    const updated = await tx.schedule.update({
      where: { id },
      data: { deletedAt: null, updatedById: userId },
      include: adminInclude,
    });
    await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
    return updated;
  });
  await revalidateTags(scheduleTags(row.training.slug));
  return toDto(restored, appToday());
}

// ===== Publik =====

export type PublicSchedule = {
  id: string;
  training: {
    slug: string;
    title: string;
    categories: { slug: string; name: string }[];
  };
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: string;
  // null kalau pelatihan menyembunyikan harga (showPrice false): tampil "Hubungi marketing".
  price: number | null;
  showPrice: boolean;
  status: PublicScheduleStatus;
};

export type PublicScheduleList = {
  items: PublicSchedule[];
  meta: ListMeta & { cities: string[]; month: string | null; upcomingOnly: boolean };
};

export async function listPublicSchedules(query: PublicScheduleQuery, now = new Date()): Promise<PublicScheduleList> {
  const today = appToday(now);
  const visibleTraining = publicTrainingWhere(now);
  const base: Prisma.ScheduleWhereInput = {
    deletedAt: null,
    training: {
      ...visibleTraining,
      ...(query.kategori
        ? { categories: { some: { category: { slug: query.kategori, deletedAt: null } } } }
        : {}),
    },
  };
  // Tanpa bulan: sesi yang belum selesai. Dengan bulan: semua sesi yang mulai di bulan itu.
  const range: Prisma.ScheduleWhereInput = query.bulan
    ? { startDate: { gte: monthRange(query.bulan).start, lt: monthRange(query.bulan).end } }
    : { endDate: { gte: today } };
  const where: Prisma.ScheduleWhereInput = {
    ...base,
    ...range,
    ...(query.kota ? { city: { equals: query.kota, mode: "insensitive" } } : {}),
  };

  const db = getDb();
  const [rows, total, cityRows] = await Promise.all([
    db.schedule.findMany({
      where,
      include: {
        training: {
          select: {
            slug: true,
            title: true,
            showPrice: true,
            categories: {
              select: { category: { select: { slug: true, name: true, order: true, deletedAt: true } } },
            },
          },
        },
      },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      ...pagination(query.hal, query.per),
    }),
    db.schedule.count({ where }),
    // Pilihan filter kota: kota dari sesi yang terlihat dengan filter bulan/kategori yang sama.
    db.schedule.findMany({
      where: { ...base, ...range, city: { not: null } },
      distinct: ["city"],
      select: { city: true },
      orderBy: { city: "asc" },
      take: 200,
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      training: {
        slug: row.training.slug,
        title: row.training.title,
        categories: row.training.categories
          .map((link) => link.category)
          .filter((category) => category.deletedAt === null)
          .sort((a, b) => a.order - b.order)
          .map(({ slug, name }) => ({ slug, name })),
      },
      startDate: toDateString(row.startDate),
      endDate: toDateString(row.endDate),
      city: row.city,
      venue: row.venue,
      method: row.method,
      price: row.training.showPrice ? row.price : null,
      showPrice: row.training.showPrice,
      status: scheduleDisplayStatus(row, today),
    })),
    meta: {
      ...listMeta(query.hal, query.per, total),
      cities: cityRows.flatMap((row) => (row.city ? [row.city] : [])),
      month: query.bulan ?? null,
      upcomingOnly: !query.bulan,
    },
  };
}
