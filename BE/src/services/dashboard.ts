import { getDb } from "@/lib/db";

export type DashboardStats = {
  trainings: number;
  categories: number;
  schedulesThisMonth: number;
  media: number;
};

// Ringkasan sederhana untuk dashboard admin (PRD 6.1). Item di Sampah tidak dihitung.
export async function getDashboardStats(now = new Date()): Promise<DashboardStats> {
  const db = getDb();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [trainings, categories, schedulesThisMonth, media] = await Promise.all([
    db.training.count({ where: { deletedAt: null } }),
    db.category.count({ where: { deletedAt: null } }),
    db.schedule.count({
      where: { deletedAt: null, startDate: { gte: monthStart, lt: nextMonthStart } },
    }),
    db.media.count({ where: { deletedAt: null } }),
  ]);

  return { trainings, categories, schedulesThisMonth, media };
}
