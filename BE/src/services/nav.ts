import type { NavItem, NavLocation, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { revalidateTags, RevalidateTag } from "@/lib/revalidate";
import type { ReorderInput } from "@/lib/validators/common";
import type { NavCreateInput, NavUpdateInput } from "@/lib/validators/nav";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";

// Menu header & footer, nested 1 level: item induk (parentId null) boleh punya anak,
// anak tidak boleh punya anak lagi. Batas kedalaman dicek di sini, bukan di DB.

export type NavItemDto = {
  id: string;
  location: NavLocation;
  label: string;
  href: string;
  parentId: string | null;
  order: number;
  children: NavItemDto[];
};

export type PublicNavItem = { label: string; href: string; children: PublicNavItem[] };

const ENTITY = "NavItem";
const FIELDS = ["label", "href", "parentId", "order"] as const;

function toDto(item: NavItem, children: NavItemDto[] = []): NavItemDto {
  return {
    id: item.id,
    location: item.location,
    label: item.label,
    href: item.href,
    parentId: item.parentId,
    order: item.order,
    children,
  };
}

function buildTree(items: NavItem[]): NavItemDto[] {
  const sorted = [...items].sort(
    (a, b) => a.order - b.order || a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const roots = sorted.filter((item) => item.parentId === null);
  return roots.map((root) =>
    toDto(
      root,
      sorted.filter((item) => item.parentId === root.id).map((child) => toDto(child)),
    ),
  );
}

async function activeItems(location: NavLocation): Promise<NavItem[]> {
  return getDb().navItem.findMany({ where: { location, deletedAt: null } });
}

export async function listNav(location: NavLocation): Promise<NavItemDto[]> {
  return buildTree(await activeItems(location));
}

async function findActive(id: string): Promise<NavItem> {
  const item = await getDb().navItem.findFirst({ where: { id, deletedAt: null } });
  if (!item) throw new HttpError(404, "NOT_FOUND", "Menu tidak ditemukan.");
  return item;
}

const PARENT_ERROR = "Menu induk tidak valid.";

// Induk harus aktif, di lokasi yang sama, dan bukan anak (maksimal 1 level).
async function assertValidParent(parentId: string, location: NavLocation, selfId?: string): Promise<void> {
  if (parentId === selfId) {
    throw new HttpError(422, "VALIDATION_ERROR", PARENT_ERROR, {
      parentId: ["Menu tidak bisa menjadi induk dirinya sendiri."],
    });
  }
  const parent = await getDb().navItem.findFirst({ where: { id: parentId, deletedAt: null } });
  if (!parent || parent.location !== location) {
    throw new HttpError(422, "VALIDATION_ERROR", PARENT_ERROR, {
      parentId: ["Menu induk tidak ditemukan di lokasi yang sama."],
    });
  }
  if (parent.parentId !== null) {
    throw new HttpError(422, "VALIDATION_ERROR", PARENT_ERROR, {
      parentId: ["Submenu tidak boleh punya submenu lagi (maksimal 1 level)."],
    });
  }
}

async function nextOrder(location: NavLocation, parentId: string | null): Promise<number> {
  const result = await getDb().navItem.aggregate({
    where: { location, parentId, deletedAt: null },
    _max: { order: true },
  });
  return (result._max.order ?? -1) + 1;
}

export async function createNavItem(input: NavCreateInput, userId: string): Promise<NavItemDto> {
  if (input.parentId) await assertValidParent(input.parentId, input.location);
  const order = await nextOrder(input.location, input.parentId);

  const item = await getDb().$transaction(async (tx) => {
    const created = await tx.navItem.create({
      data: {
        location: input.location,
        label: input.label,
        href: input.href,
        parentId: input.parentId,
        order,
        updatedById: userId,
      },
    });
    await writeAudit(
      {
        userId,
        action: AuditAction.CREATE,
        entity: ENTITY,
        entityId: created.id,
        diff: { location: created.location, ...diffFields(null, created, FIELDS) } as Prisma.InputJsonValue,
      },
      tx,
    );
    return created;
  });

  await revalidateTags([RevalidateTag.NAV]);
  return toDto(item);
}

export async function updateNavItem(
  id: string,
  input: NavUpdateInput,
  userId: string,
): Promise<NavItemDto> {
  const before = await findActive(id);
  const data: Prisma.NavItemUncheckedUpdateInput = { updatedById: userId };
  if (input.label !== undefined) data.label = input.label;
  if (input.href !== undefined) data.href = input.href;

  if (input.parentId !== undefined && input.parentId !== before.parentId) {
    if (input.parentId) {
      await assertValidParent(input.parentId, before.location, id);
      const childCount = await getDb().navItem.count({ where: { parentId: id, deletedAt: null } });
      if (childCount > 0) {
        throw new HttpError(422, "VALIDATION_ERROR", PARENT_ERROR, {
          parentId: ["Menu yang punya submenu tidak bisa dijadikan submenu."],
        });
      }
    }
    data.parentId = input.parentId;
    data.order = await nextOrder(before.location, input.parentId);
  }

  const item = await getDb().$transaction(async (tx) => {
    const updated = await tx.navItem.update({ where: { id }, data });
    await writeAudit(
      {
        userId,
        action: AuditAction.UPDATE,
        entity: ENTITY,
        entityId: id,
        diff: diffFields(before, updated, FIELDS) as Prisma.InputJsonValue,
      },
      tx,
    );
    return updated;
  });

  await revalidateTags([RevalidateTag.NAV]);
  return toDto(item);
}

// Soft delete; submenu ikut dihapus supaya tidak ada anak yatim di menu publik.
export async function deleteNavItem(id: string, userId: string): Promise<void> {
  const item = await findActive(id);
  const now = new Date();
  await getDb().$transaction(async (tx) => {
    await tx.navItem.updateMany({
      where: { OR: [{ id }, { parentId: id }], deletedAt: null },
      data: { deletedAt: now, updatedById: userId },
    });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { label: item.label } },
      tx,
    );
  });
  await revalidateTags([RevalidateTag.NAV]);
}

export async function restoreNavItem(id: string, userId: string): Promise<NavItemDto> {
  const item = await getDb().navItem.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!item) throw new HttpError(404, "NOT_FOUND", "Menu tidak ditemukan di Sampah.");
  if (item.parentId) {
    const parent = await getDb().navItem.findFirst({ where: { id: item.parentId, deletedAt: null } });
    if (!parent) {
      throw new HttpError(409, "PARENT_DELETED", "Pulihkan menu induknya dulu.");
    }
  }
  const order = await nextOrder(item.location, item.parentId);
  const restored = await getDb().$transaction(async (tx) => {
    const updated = await tx.navItem.update({
      where: { id },
      data: { deletedAt: null, order, updatedById: userId },
    });
    await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
    return updated;
  });
  await revalidateTags([RevalidateTag.NAV]);
  return toDto(restored);
}

// Urutan baru untuk satu kelompok saudara (lokasi + induk yang sama). Daftar id harus lengkap
// supaya tidak ada item yang urutannya tertinggal di posisi lama.
export async function reorderNav(input: ReorderInput, userId: string): Promise<void> {
  const db = getDb();
  const first = await findActive(input.ids[0]);
  const siblings = await db.navItem.findMany({
    where: { location: first.location, parentId: first.parentId, deletedAt: null },
    select: { id: true },
  });
  const siblingIds = new Set(siblings.map((row) => row.id));
  if (siblingIds.size !== input.ids.length || !input.ids.every((id) => siblingIds.has(id))) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Urutan harus berisi semua menu dalam satu kelompok yang sama.",
      { ids: ["Daftar menu tidak lengkap atau berasal dari kelompok berbeda."] },
    );
  }

  await db.$transaction(async (tx) => {
    for (const [order, id] of input.ids.entries()) {
      await tx.navItem.update({ where: { id }, data: { order, updatedById: userId } });
    }
    await writeAudit(
      {
        userId,
        action: AuditAction.REORDER,
        entity: ENTITY,
        diff: { location: first.location, parentId: first.parentId, ids: input.ids },
      },
      tx,
    );
  });
  await revalidateTags([RevalidateTag.NAV]);
}

// ===== Publik =====

function toPublic(items: NavItemDto[]): PublicNavItem[] {
  return items.map((item) => ({ label: item.label, href: item.href, children: toPublic(item.children) }));
}

export async function getPublicNav(): Promise<{ header: PublicNavItem[]; footer: PublicNavItem[] }> {
  const items = await getDb().navItem.findMany({ where: { deletedAt: null } });
  return {
    header: toPublic(buildTree(items.filter((item) => item.location === "HEADER"))),
    footer: toPublic(buildTree(items.filter((item) => item.location === "FOOTER"))),
  };
}
