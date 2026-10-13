import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { appDateString, appToday, monthRange } from "@/lib/time";
import { TRAINING_ISSUES } from "@/lib/validators/training";
import { inquirySummary } from "@/services/inquiry";

type InquirySummary = Awaited<ReturnType<typeof inquirySummary>>;

// Dashboard admin (PRD 6.1). Semua hitungan tanpa item di Sampah; tanggal memakai WIB (lib/time).

export const ATTENTION_PREVIEW = 5;
export const STALE_DRAFT_DAYS = 30;
export const ACTIVITY_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DashboardCounts = {
  trainings: { published: number; scheduled: number; draft: number };
  categories: number;
  schedules: { thisMonth: number; next30Days: number; fullUpcoming: number };
  // Info, bukan masalah: pelatihan public tayang tanpa sesi mendatang.
  publicWithoutUpcoming: number;
};

export const ATTENTION_KEYS = [
  "trainingNoCover",
  "trainingCoverNoAlt",
  "staleDraft",
  "publishedNoSummary",
  "pastOpenSchedule",
  "serviceNoImage",
] as const;
export type AttentionKey = (typeof ATTENTION_KEYS)[number];

export type AttentionItem = { id: string; title: string; detail?: string };
export type AttentionGroup = { key: AttentionKey; count: number; items: AttentionItem[] };

export type ActivityItem = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userName: string | null;
  createdAt: string;
  // Entitas masih ada (belum di Sampah / tidak dihapus permanen): FE boleh menautkan halaman edit.
  linkable: boolean;
};

export type Dashboard = {
  counts: DashboardCounts;
  attention: AttentionGroup[];
  activity: ActivityItem[];
  inquiries: InquirySummary;
  // Diisi setelah modul Evaluasi dibuat (Fase 4.3); null = modul belum ada.
  evaluations: null;
};

// Filter "perlu dibereskan" pelatihan, dipakai dashboard dan daftar admin (?issue=...).
export type TrainingIssue = (typeof TRAINING_ISSUES)[number];

export function trainingIssueWhere(issue: TrainingIssue, now: Date): Prisma.TrainingWhereInput {
  switch (issue) {
    case "no-cover":
      return { coverId: null };
    case "cover-no-alt":
      return { cover: { is: { OR: [{ alt: null }, { alt: "" }] } } };
    case "stale-draft":
      return { status: "DRAFT", updatedAt: { lt: new Date(now.getTime() - STALE_DRAFT_DAYS * DAY_MS) } };
    case "no-summary":
      // Meta description jatuh ke ringkasan; tanpa ringkasan dan tanpa SEO description = kosong.
      // seo selalu berbentuk { title, description, ogImageId } (default validator) atau null.
      return {
        status: "PUBLISHED",
        AND: [
          { OR: [{ summary: null }, { summary: "" }] },
          { OR: [{ seo: { equals: Prisma.DbNull } }, { seo: { path: ["description"], equals: "" } }] },
        ],
      };
  }
}

const ISSUE_OF: Partial<Record<AttentionKey, TrainingIssue>> = {
  trainingNoCover: "no-cover",
  trainingCoverNoAlt: "cover-no-alt",
  staleDraft: "stale-draft",
  publishedNoSummary: "no-summary",
};

// Entitas AuditLog -> model untuk cek "masih ada" (soft delete). Lainnya tidak ditautkan.
const LINKABLE_ENTITIES = ["Training", "Category", "Service", "Page", "HomeSection", "PortfolioItem", "Client", "Testimonial", "MarketingContact", "Media", "Inquiry"] as const;
type LinkableEntity = (typeof LINKABLE_ENTITIES)[number];

async function existingIds(entity: LinkableEntity, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const db = getDb();
  const where = { id: { in: ids }, deletedAt: null };
  const select = { id: true } as const;
  const rows: { id: string }[] = await {
    Training: () => db.training.findMany({ where, select }),
    Category: () => db.category.findMany({ where, select }),
    Service: () => db.service.findMany({ where, select }),
    Page: () => db.page.findMany({ where, select }),
    HomeSection: () => db.homeSection.findMany({ where, select }),
    PortfolioItem: () => db.portfolioItem.findMany({ where, select }),
    Client: () => db.client.findMany({ where, select }),
    Testimonial: () => db.testimonial.findMany({ where, select }),
    MarketingContact: () => db.marketingContact.findMany({ where, select }),
    Media: () => db.media.findMany({ where, select }),
    Inquiry: () => db.inquiry.findMany({ where, select }),
  }[entity]();
  return new Set(rows.map((row) => row.id));
}

const isLinkable = (entity: string): entity is LinkableEntity => (LINKABLE_ENTITIES as readonly string[]).includes(entity);

async function recentActivity(): Promise<ActivityItem[]> {
  const rows = await getDb().auditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: ACTIVITY_LIMIT,
    include: { user: { select: { name: true } } },
  });
  const byEntity = new Map<LinkableEntity, string[]>();
  for (const row of rows) {
    if (row.entityId && isLinkable(row.entity)) byEntity.set(row.entity, [...(byEntity.get(row.entity) ?? []), row.entityId]);
  }
  const alive = new Map(
    await Promise.all([...byEntity].map(async ([entity, ids]) => [entity, await existingIds(entity, ids)] as const)),
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    userName: row.user?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    linkable: Boolean(row.entityId && isLinkable(row.entity) && alive.get(row.entity)?.has(row.entityId)),
  }));
}

async function trainingGroup(key: AttentionKey, now: Date): Promise<AttentionGroup> {
  const issue = ISSUE_OF[key];
  if (!issue) throw new Error(`Bukan grup pelatihan: ${key}`);
  const db = getDb();
  const where: Prisma.TrainingWhereInput = { deletedAt: null, ...trainingIssueWhere(issue, now) };
  const [count, rows] = await Promise.all([
    db.training.count({ where }),
    db.training.findMany({ where, select: { id: true, title: true }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: ATTENTION_PREVIEW }),
  ]);
  return { key, count, items: rows };
}

export async function getDashboard(now = new Date()): Promise<Dashboard> {
  const db = getDb();
  const today = appToday(now);
  const in30 = new Date(today.getTime() + 30 * DAY_MS);
  const month = monthRange(appDateString(now).slice(0, 7));
  const upcoming: Prisma.ScheduleWhereInput = { deletedAt: null, endDate: { gte: today }, status: { in: ["OPEN", "FULL"] } };
  const pastOpen: Prisma.ScheduleWhereInput = { deletedAt: null, status: "OPEN", endDate: { lt: today } };

  const [
    published,
    scheduled,
    draft,
    categories,
    thisMonth,
    next30Days,
    fullUpcoming,
    publicWithoutUpcoming,
    pastOpenCount,
    pastOpenRows,
    serviceNoImageCount,
    serviceNoImageRows,
    ...rest
  ] = await Promise.all([
    db.training.count({ where: { deletedAt: null, status: "PUBLISHED", publishedAt: { lte: now } } }),
    db.training.count({ where: { deletedAt: null, status: "PUBLISHED", publishedAt: { gt: now } } }),
    db.training.count({ where: { deletedAt: null, status: "DRAFT" } }),
    db.category.count({ where: { deletedAt: null } }),
    db.schedule.count({ where: { deletedAt: null, startDate: { gte: month.start, lt: month.end } } }),
    db.schedule.count({ where: { deletedAt: null, startDate: { gte: today, lte: in30 } } }),
    db.schedule.count({ where: { ...upcoming, status: "FULL" } }),
    db.training.count({
      where: { deletedAt: null, status: "PUBLISHED", publishedAt: { lte: now }, types: { has: "PUBLIC" }, schedules: { none: upcoming } },
    }),
    db.schedule.count({ where: pastOpen }),
    db.schedule.findMany({
      where: pastOpen,
      select: { id: true, startDate: true, endDate: true, training: { select: { title: true } } },
      orderBy: [{ endDate: "asc" }, { id: "asc" }],
      take: ATTENTION_PREVIEW,
    }),
    db.service.count({ where: { deletedAt: null, imageId: null } }),
    db.service.findMany({
      where: { deletedAt: null, imageId: null },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { id: "asc" }],
      take: ATTENTION_PREVIEW,
    }),
    trainingGroup("trainingNoCover", now),
    trainingGroup("trainingCoverNoAlt", now),
    trainingGroup("staleDraft", now),
    trainingGroup("publishedNoSummary", now),
    recentActivity(),
    inquirySummary(now),
  ]);
  const [noCover, coverNoAlt, staleDraft, noSummary, activity, inquiries] = rest as [
    AttentionGroup,
    AttentionGroup,
    AttentionGroup,
    AttentionGroup,
    ActivityItem[],
    InquirySummary,
  ];

  return {
    counts: {
      trainings: { published, scheduled, draft },
      categories,
      schedules: { thisMonth, next30Days, fullUpcoming },
      publicWithoutUpcoming,
    },
    attention: [
      noCover,
      coverNoAlt,
      staleDraft,
      noSummary,
      {
        key: "pastOpenSchedule",
        count: pastOpenCount,
        items: pastOpenRows.map((row) => ({
          id: row.id,
          title: row.training.title,
          detail: `${row.startDate.toISOString().slice(0, 10)} s.d. ${row.endDate.toISOString().slice(0, 10)}`,
        })),
      },
      { key: "serviceNoImage", count: serviceNoImageCount, items: serviceNoImageRows },
    ],
    activity,
    inquiries,
    evaluations: null,
  };
}
