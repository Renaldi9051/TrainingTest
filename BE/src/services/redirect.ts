import type { Prisma } from "@/generated/prisma/client";
import { AuditAction, writeAudit } from "@/services/audit";

type Tx = Pick<Prisma.TransactionClient, "redirect" | "auditLog">;

// Path publik per entitas yang punya slug.
export const publicPath = {
  training: (slug: string) => `/pelatihan/${slug}`,
  category: (slug: string) => `/pelatihan/kategori/${slug}`,
};

// Path yang sekarang dipakai konten aktif tidak boleh di-redirect ke tempat lain.
// Dipanggil saat konten dibuat, dipulihkan, atau pindah ke slug yang dulu pernah di-redirect.
export async function releaseRedirectPath(tx: Tx, path: string, userId: string): Promise<void> {
  const active = await tx.redirect.findFirst({ where: { from: path, deletedAt: null } });
  if (!active) return;
  await tx.redirect.update({
    where: { id: active.id },
    data: { deletedAt: new Date(), updatedBy: { connect: { id: userId } } },
  });
  await writeAudit(
    {
      userId,
      action: AuditAction.DELETE,
      entity: "Redirect",
      entityId: active.id,
      diff: { from: active.from, to: active.to, reason: "path dipakai konten aktif" },
    },
    tx,
  );
}

// Slug konten publik berubah: catat redirect 301 dari path lama ke path baru.
// Redirect lama yang menuju path lama ikut diarahkan ke path baru supaya tidak ada rantai redirect.
// Eksekusi redirect di FE/proxy menyusul di Fase 5 (lihat BACKLOG); datanya dicatat dari sekarang.
export async function recordSlugRedirect(
  tx: Tx,
  { from, to, userId }: { from: string; to: string; userId: string },
): Promise<void> {
  if (from === to) return;

  await releaseRedirectPath(tx, to, userId);

  await tx.redirect.updateMany({
    where: { to: from, deletedAt: null },
    data: { to, updatedById: userId },
  });

  const existing = await tx.redirect.findFirst({ where: { from, deletedAt: null } });
  const redirect = existing
    ? await tx.redirect.update({
        where: { id: existing.id },
        data: { to, code: "PERMANENT", updatedBy: { connect: { id: userId } } },
      })
    : await tx.redirect.create({
        data: { from, to, code: "PERMANENT", updatedBy: { connect: { id: userId } } },
      });

  await writeAudit(
    {
      userId,
      action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
      entity: "Redirect",
      entityId: redirect.id,
      diff: { from, to, code: "PERMANENT", reason: "slug berubah" },
    },
    tx,
  );
}
