import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

export const AuditAction = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  RESTORE: "RESTORE",
  REORDER: "REORDER",
  DUPLICATE: "DUPLICATE",
  BULK: "BULK",
  IMPORT: "IMPORT",
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

// Client Prisma biasa atau client di dalam $transaction.
export type DbClient = Pick<Prisma.TransactionClient, "auditLog">;

export async function writeAudit(
  entry: {
    userId: string | null;
    action: AuditActionName;
    entity: string;
    entityId?: string | null;
    diff?: Prisma.InputJsonValue;
  },
  db: DbClient = getDb(),
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      diff: entry.diff,
    },
  });
}

export type FieldDiff = Record<string, { from: Prisma.InputJsonValue | null; to: Prisma.InputJsonValue | null }>;

function toJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// Hanya field yang benar-benar berubah. Nilai dibandingkan lewat bentuk JSON-nya,
// jadi Date, array, dan objek rich text ikut terbandingkan dengan benar.
export function diffFields<T extends Record<string, unknown>>(
  before: Partial<T> | null,
  after: Partial<T>,
  keys: readonly (keyof T & string)[],
): FieldDiff {
  const diff: FieldDiff = {};
  for (const key of keys) {
    const from = toJsonValue(before?.[key]);
    const to = toJsonValue(after[key]);
    if (JSON.stringify(from) !== JSON.stringify(to)) diff[key] = { from, to };
  }
  return diff;
}
