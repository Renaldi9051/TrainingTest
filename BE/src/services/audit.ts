import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

export const AuditAction = {
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;

export type AuditActionName = (typeof AuditAction)[keyof typeof AuditAction];

export async function writeAudit(entry: {
  userId: string | null;
  action: AuditActionName;
  entity: string;
  entityId?: string | null;
  diff?: Prisma.InputJsonValue;
}): Promise<void> {
  await getDb().auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      diff: entry.diff,
    },
  });
}
