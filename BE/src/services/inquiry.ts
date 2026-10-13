import type { Inquiry, Prisma } from "@/generated/prisma/client";
import { toCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { listMeta, pagination, type ListMeta } from "@/lib/list-query";
import { getInquiryRateLimiters, type RateLimiter } from "@/lib/rate-limit";
import { appDateString } from "@/lib/time";
import {
  CONSENT_VERSION,
  type InquiryCreateInput,
  type InquiryExportQuery,
  type InquiryListQuery,
  type InquiryUpdateInput,
} from "@/lib/validators/inquiry";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { getInquiryNotifier, type InquiryNotifier } from "@/services/inquiry-notify";
import { publicTrainingWhere } from "@/services/training-visibility";

// Inquiry (PRD 5.6, 5.9, 6.1). Kiriman pengunjung tidak ditulis ke AuditLog (bukan perubahan
// konten, dan supaya aktivitas admin tidak tenggelam); mutasi admin & ekspor di-audit.

const ENTITY = "Inquiry";
const AUDIT_FIELDS = ["status", "note"] as const;

// Masa simpan (sementara, menunggu konfirmasi): dihapus permanen 24 bulan setelah perubahan
// terakhir; yang di Sampah dihapus permanen 30 hari setelah dihapus.
export const RETENTION_MONTHS = 24;
export const TRASH_RETENTION_DAYS = 30;
export const EXPORT_MAX_ROWS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

type InquiryRow = Inquiry & { training: { id: string; slug: string; title: string } | null };
const include = { training: { select: { id: true, slug: true, title: true } } } satisfies Prisma.InquiryInclude;

export type InquiryDto = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  training: { id: string; slug: string; title: string } | null;
  interest: string | null;
  message: string | null;
  source: "TRAINING_DETAIL" | "CONTACT";
  consentAt: Date | null;
  consentVersion: string | null;
  status: "NEW" | "IN_PROGRESS" | "DONE";
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toDto(row: InquiryRow): InquiryDto {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    training: row.training,
    interest: row.interest,
    message: row.message,
    source: row.source,
    consentAt: row.consentAt,
    consentVersion: row.consentVersion,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ===== Publik =====

export type InquiryMeta = { ip: string };
export type InquiryLimiters = { ip: RateLimiter; email: RateLimiter };

function tooMany(retryAfterMs: number): HttpError {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return new HttpError(
    429,
    "TOO_MANY_REQUESTS",
    `Terlalu banyak kiriman. Coba lagi dalam ${minutes} menit.`,
    undefined,
    undefined,
    { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
  );
}

// Kiriman form publik. Honeypot terisi: dibalas seperti sukses tanpa menyimpan (bot tidak belajar).
// Rate limit: 5 kiriman / 10 menit per IP, 3 / jam per email (in-memory, satu proses BE).
// Pelatihan (dari slug) hanya ditautkan kalau tayang; selain itu null (tanpa membocorkan draf).
export async function createInquiry(
  input: InquiryCreateInput,
  meta: InquiryMeta,
  now = new Date(),
  limiters: InquiryLimiters = getInquiryRateLimiters(),
  notifier: InquiryNotifier = getInquiryNotifier(),
): Promise<{ id: string | null }> {
  if (input.website.trim() !== "") return { id: null };

  const ipKey = meta.ip;
  const emailKey = input.email;
  const nowMs = now.getTime();
  for (const status of [limiters.ip.status(ipKey, nowMs), limiters.email.status(emailKey, nowMs)]) {
    if (status.blocked) throw tooMany(status.retryAfterMs);
  }

  const db = getDb();
  const training = input.trainingSlug
    ? await db.training.findFirst({ where: { slug: input.trainingSlug, ...publicTrainingWhere(now) }, select: { id: true } })
    : null;

  const row = await db.inquiry.create({
    data: {
      name: input.name,
      company: input.company,
      email: input.email,
      phone: input.phone,
      trainingId: training?.id ?? null,
      interest: input.interest,
      message: input.message,
      source: input.source,
      consentAt: now,
      consentVersion: CONSENT_VERSION,
    },
    include,
  });
  limiters.ip.recordFailure(ipKey, nowMs);
  limiters.email.recordFailure(emailKey, nowMs);
  // Di belakang: gagal kirim notifikasi tidak menggagalkan kiriman (inquiry sudah tersimpan).
  void notifier.notify(toDto(row)).catch((error: unknown) => console.warn("Notifikasi inquiry gagal.", error));
  return { id: row.id };
}

// ===== Admin =====

// "YYYY-MM-DD" WIB -> instan UTC awal hari itu.
function wibDayStart(date: string): Date {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() - WIB_OFFSET_MS);
}

function filterWhere(query: { status?: InquiryListQuery["status"]; from?: string; to?: string; q?: string }): Prisma.InquiryWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from) createdAt.gte = wibDayStart(query.from);
  if (query.to) createdAt.lt = new Date(wibDayStart(query.to).getTime() + DAY_MS);
  return {
    deletedAt: null,
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to ? { createdAt } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { company: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listInquiries(query: InquiryListQuery): Promise<{ items: InquiryDto[]; meta: ListMeta }> {
  const where = filterWhere(query);
  const db = getDb();
  const [rows, total] = await Promise.all([
    db.inquiry.findMany({
      where,
      include,
      orderBy: [{ [query.sort.field]: query.sort.direction }, { id: "desc" }],
      ...pagination(query.page, query.pageSize),
    }),
    db.inquiry.count({ where }),
  ]);
  return { items: rows.map(toDto), meta: listMeta(query.page, query.pageSize, total) };
}

async function findActive(id: string): Promise<InquiryRow> {
  const row = await getDb().inquiry.findFirst({ where: { id, deletedAt: null }, include });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Inquiry tidak ditemukan.");
  return row;
}

export async function getInquiry(id: string): Promise<InquiryDto> {
  return toDto(await findActive(id));
}

export async function updateInquiry(id: string, input: InquiryUpdateInput, userId: string): Promise<InquiryDto> {
  const before = await findActive(id);
  const data: Prisma.InquiryUncheckedUpdateInput = { updatedById: userId };
  if (input.status !== undefined) data.status = input.status;
  if (input.note !== undefined) data.note = input.note;
  const updated = await getDb().$transaction(async (tx) => {
    const row = await tx.inquiry.update({ where: { id }, data, include });
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
  return toDto(updated);
}

export async function deleteInquiry(id: string, userId: string): Promise<void> {
  await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.inquiry.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    // Tanpa data pribadi di log.
    await writeAudit({ userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id }, tx);
  });
}

export async function restoreInquiry(id: string, userId: string): Promise<InquiryDto> {
  const row = await getDb().inquiry.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Inquiry tidak ditemukan di Sampah.");
  const restored = await getDb().$transaction(async (tx) => {
    const updated = await tx.inquiry.update({ where: { id }, data: { deletedAt: null, updatedById: userId }, include });
    await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
    return updated;
  });
  return toDto(restored);
}

export const INQUIRY_STATUS_TEXT: Record<InquiryDto["status"], string> = { NEW: "Baru", IN_PROGRESS: "Diproses", DONE: "Selesai" };
const SOURCE_TEXT: Record<InquiryDto["source"], string> = { TRAINING_DETAIL: "Detail pelatihan", CONTACT: "Halaman kontak" };

const wibDateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

// Ekspor CSV (UTF-8 + BOM, pemisah ;, aman dari formula injection). Ekspor dicatat di AuditLog
// (filter + jumlah baris, tanpa isi data).
export async function exportInquiries(
  query: InquiryExportQuery,
  userId: string,
  now = new Date(),
): Promise<{ filename: string; body: string; rows: number }> {
  const rows = await getDb().inquiry.findMany({
    where: filterWhere(query),
    include,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_MAX_ROWS,
  });
  const body = toCsv(
    ["Tanggal (WIB)", "Status", "Nama", "Instansi", "Email", "WhatsApp", "Pelatihan", "Minat", "Pesan", "Sumber", "Catatan", "Persetujuan"],
    rows.map((row) => [
      wibDateTime.format(row.createdAt),
      INQUIRY_STATUS_TEXT[row.status],
      row.name,
      row.company,
      row.email,
      row.phone,
      row.training?.title ?? null,
      row.interest,
      row.message,
      SOURCE_TEXT[row.source],
      row.note,
      row.consentAt ? `${wibDateTime.format(row.consentAt)} (v${row.consentVersion ?? "-"})` : null,
    ]),
  );
  await writeAudit({
    userId,
    action: AuditAction.EXPORT,
    entity: ENTITY,
    diff: { filter: { status: query.status ?? null, from: query.from ?? null, to: query.to ?? null, q: query.q ?? null }, rows: rows.length },
  });
  return { filename: `inquiry-${appDateString(now)}.csv`, body, rows: rows.length };
}

// Dijalankan scheduler BE sekali per hari: hapus permanen inquiry lewat masa simpan. Hanya jumlah
// yang dicatat (entity InquiryPurge), bukan datanya.
export async function purgeExpiredInquiries(now = new Date()): Promise<number> {
  const retentionCutoff = new Date(now);
  retentionCutoff.setUTCMonth(retentionCutoff.getUTCMonth() - RETENTION_MONTHS);
  const trashCutoff = new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS);
  const { count } = await getDb().inquiry.deleteMany({
    where: { OR: [{ updatedAt: { lt: retentionCutoff } }, { deletedAt: { lt: trashCutoff } }] },
  });
  if (count > 0) await writeAudit({ userId: null, action: AuditAction.DELETE, entity: "InquiryPurge", diff: { count } });
  return count;
}

// Ringkasan untuk dashboard: inquiry baru, 7 hari terakhir, 5 baru terbaru.
export async function inquirySummary(now = new Date()) {
  const db = getDb();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const [newCount, lastWeek, latest] = await Promise.all([
    db.inquiry.count({ where: { deletedAt: null, status: "NEW" } }),
    db.inquiry.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
    db.inquiry.findMany({
      where: { deletedAt: null, status: "NEW" },
      include,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
    }),
  ]);
  return {
    new: newCount,
    lastWeek,
    latest: latest.map((row) => ({
      id: row.id,
      name: row.name,
      training: row.training?.title ?? row.interest,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

// Jumlah inquiry baru untuk badge sidebar admin.
export async function countNewInquiries(): Promise<number> {
  return getDb().inquiry.count({ where: { deletedAt: null, status: "NEW" } });
}
