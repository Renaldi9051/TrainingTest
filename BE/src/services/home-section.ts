import type { HomeSection, HomeSectionType, Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { HttpError, zodFieldErrors } from "@/lib/http";
import { revalidateEntity } from "@/lib/revalidate-map";
import { isUniqueViolation } from "@/lib/slug";
import { appToday } from "@/lib/time";
import {
  HOME_SECTION_CONTENT_SCHEMAS,
  HOME_SECTION_LABELS,
  homeSectionMediaRefs,
  isRetiredHomeSectionType,
  type RetiredHomeSectionType,
  safeParseHomeSectionContent,
  SINGLE_INSTANCE_TYPES,
  type HomeSectionContent,
  type HomeSectionContentMap,
  type HomeSectionCreateInput,
  type HomeSectionUpdateInput,
} from "@/lib/validators/home-section";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { toPublicClient, type PublicClient } from "@/services/client";
import { assertMediaRefs, getMediaMap, toPublicImage, type MediaDto, type PublicImage } from "@/services/media";
import { nextOrder } from "@/services/reorder";
import { publicScheduleInclude, toPublicSchedule, type PublicSchedule } from "@/services/schedule";
import { resolveSelections, type Selection } from "@/services/selection";
import { toPublicTestimonial, type PublicTestimonial } from "@/services/testimonial";
import { cardInclude, toCard, type PublicTrainingCard } from "@/services/training-public";
import { publicTrainingWhere } from "@/services/training-visibility";

const ENTITY = "HomeSection";
const AUDIT_FIELDS = ["title", "visible", "content"] as const;

const isSingleInstance = (type: HomeSectionType) => (SINGLE_INSTANCE_TYPES as readonly HomeSectionType[]).includes(type);

// ===== DTO admin =====

export type HomeSectionDto = {
  id: string;
  type: HomeSectionType;
  title: string | null;
  visible: boolean;
  order: number;
  // Isi tersimpan; null kalau sudah tidak lolos skema (mis. data lama) dan perlu diisi ulang.
  content: HomeSectionContent["content"] | null;
  // Media yang dirujuk isi (gambar hero), untuk pratinjau di editor.
  media: Record<string, MediaDto>;
  createdAt: Date;
  updatedAt: Date;
};

function parsedContent(row: HomeSection): HomeSectionContent | null {
  const content = safeParseHomeSectionContent(row.type, row.content);
  return content ? ({ type: row.type, content } as HomeSectionContent) : null;
}

async function toDto(row: HomeSection): Promise<HomeSectionDto> {
  const section = parsedContent(row);
  const media = section ? await getMediaMap(homeSectionMediaRefs(section).map((ref) => ref.mediaId)) : new Map();
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    visible: row.visible,
    order: row.order,
    content: section?.content ?? null,
    media: Object.fromEntries(media),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function singleInstanceError(type: HomeSectionType, restoring: boolean): HttpError {
  const label = HOME_SECTION_LABELS[type];
  return new HttpError(
    409,
    "SECTION_EXISTS",
    restoring
      ? `Section ${label} yang aktif sudah ada. Hapus section ${label} itu dulu sebelum memulihkan yang ini.`
      : `Section ${label} sudah ada. Beranda hanya boleh punya satu ${label}.`,
  );
}

// HERO/CTA maksimal satu di antara section aktif. Cek di sini untuk pesan yang jelas; partial
// unique index HomeSection_single_type_key menjaga balapan (P2002 -> 409 yang sama).
async function assertSingleInstanceFree(type: HomeSectionType, restoring: boolean, excludeId?: string): Promise<void> {
  if (!isSingleInstance(type)) return;
  const existing = await getDb().homeSection.count({
    where: { type, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing > 0) throw singleInstanceError(type, restoring);
}

async function withSingleInstanceConflict<T>(type: HomeSectionType, restoring: boolean, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isUniqueViolation(error)) throw singleInstanceError(type, restoring);
    throw error;
  }
}

// Isi divalidasi terhadap type yang tersimpan. Error dikembalikan dengan path form "content.<path>".
function parseContentFor(type: HomeSectionType, content: unknown): HomeSectionContent {
  const parsed = HOME_SECTION_CONTENT_SCHEMAS[type].safeParse(content);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      Object.entries(zodFieldErrors(parsed.error)).map(([key, messages]) => [key ? `content.${key}` : "content", messages]),
    );
    throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid.", fields);
  }
  return { type, content: parsed.data } as HomeSectionContent;
}

async function assertSectionMedia(section: HomeSectionContent): Promise<void> {
  await assertMediaRefs(
    homeSectionMediaRefs(section).map((ref) => ({
      field: `content.${ref.path}`,
      mediaId: ref.mediaId,
      kind: ref.kind,
      requireAlt: ref.requireAlt,
    })),
  );
}

async function findActive(id: string): Promise<HomeSection> {
  const row = await getDb().homeSection.findFirst({ where: { id, deletedAt: null } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Section tidak ditemukan.");
  return row;
}

// ===== Admin =====

export async function listHomeSections(): Promise<HomeSectionDto[]> {
  const rows = await getDb().homeSection.findMany({
    where: { deletedAt: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return Promise.all(rows.map(toDto));
}

export async function getHomeSection(id: string): Promise<HomeSectionDto> {
  return toDto(await findActive(id));
}

export async function createHomeSection(input: HomeSectionCreateInput, userId: string): Promise<HomeSectionDto> {
  await assertSingleInstanceFree(input.type, false);
  await assertSectionMedia(input);
  const order = await nextOrder(getDb().homeSection);
  const created = await withSingleInstanceConflict(input.type, false, () =>
    getDb().$transaction(async (tx) => {
      const row = await tx.homeSection.create({
        data: {
          type: input.type,
          title: input.title,
          visible: input.visible,
          content: input.content as Prisma.InputJsonValue,
          order,
          updatedById: userId,
        },
      });
      await writeAudit(
        {
          userId,
          action: AuditAction.CREATE,
          entity: ENTITY,
          entityId: row.id,
          diff: { type: row.type, ...(diffFields(null, row, AUDIT_FIELDS) as Record<string, Prisma.InputJsonValue>) },
        },
        tx,
      );
      return row;
    }),
  );
  await revalidateEntity({ entity: "HomeSection" });
  return toDto(created);
}

export async function updateHomeSection(
  id: string,
  input: HomeSectionUpdateInput,
  userId: string,
): Promise<HomeSectionDto> {
  const before = await findActive(id);
  const data: Prisma.HomeSectionUncheckedUpdateInput = { updatedById: userId };
  if (input.title !== undefined) data.title = input.title;
  if (input.visible !== undefined) data.visible = input.visible;
  if (input.content !== undefined) {
    const section = parseContentFor(before.type, input.content);
    await assertSectionMedia(section);
    data.content = section.content as Prisma.InputJsonValue;
  }

  const updated = await getDb().$transaction(async (tx) => {
    const row = await tx.homeSection.update({ where: { id }, data });
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
  await revalidateEntity({ entity: "HomeSection" });
  return toDto(updated);
}

export async function deleteHomeSection(id: string, userId: string): Promise<void> {
  const row = await findActive(id);
  await getDb().$transaction(async (tx) => {
    await tx.homeSection.update({ where: { id }, data: { deletedAt: new Date(), updatedById: userId } });
    await writeAudit(
      { userId, action: AuditAction.DELETE, entity: ENTITY, entityId: id, diff: { type: row.type } },
      tx,
    );
  });
  await revalidateEntity({ entity: "HomeSection" });
}

// Pulihkan ke urutan terakhir. HERO/CTA yang bentrok dengan section aktif: 409.
export async function restoreHomeSection(id: string, userId: string): Promise<HomeSectionDto> {
  const row = await getDb().homeSection.findFirst({ where: { id, deletedAt: { not: null } } });
  if (!row) throw new HttpError(404, "NOT_FOUND", "Section tidak ditemukan di Sampah.");
  await assertSingleInstanceFree(row.type, true, id);
  const order = await nextOrder(getDb().homeSection);
  const restored = await withSingleInstanceConflict(row.type, true, () =>
    getDb().$transaction(async (tx) => {
      const updated = await tx.homeSection.update({
        where: { id },
        data: { deletedAt: null, order, updatedById: userId },
      });
      await writeAudit({ userId, action: AuditAction.RESTORE, entity: ENTITY, entityId: id }, tx);
      return updated;
    }),
  );
  await revalidateEntity({ entity: "HomeSection" });
  return toDto(restored);
}

// ===== Publik =====

type C<K extends HomeSectionType> = HomeSectionContentMap[K];
type SelectionKeys = "mode" | "limit" | "ids";
type Base<K extends HomeSectionType> = { id: string; type: K };

// Slide hero yang sudah di-resolve: gambar (URL + varian), alt (slide, atau alt media kalau kosong),
// tautan null kalau kosong. Slide dengan media terhapus/bukan gambar dibuang.
export type PublicHeroSlide = {
  image: PublicImage;
  alt: string;
  caption: string;
  href: string | null;
  hudLabel: string;
  focalX: number;
  focalY: number;
};

export type PublicHomeSection =
  | (Base<"HERO"> & Omit<C<"HERO">, "slides"> & { slides: PublicHeroSlide[] })
  | (Base<"LATEST_TRAININGS"> & Omit<C<"LATEST_TRAININGS">, SelectionKeys> & { items: PublicTrainingCard[] })
  | (Base<"UPCOMING_SCHEDULES"> & Omit<C<"UPCOMING_SCHEDULES">, "limit"> & { items: PublicSchedule[] })
  | (Base<"CLIENTS"> & Omit<C<"CLIENTS">, SelectionKeys> & { items: PublicClient[] })
  | (Base<"VISION_MISSION"> & C<"VISION_MISSION">)
  | (Base<"TESTIMONIALS"> & Omit<C<"TESTIMONIALS">, SelectionKeys> & { items: PublicTestimonial[] })
  | (Base<"CTA"> & C<"CTA">);

// Pratinjau admin: semua section (termasuk yang disembunyikan) + penanda tampil & kosong.
export type PreviewHomeSection = PublicHomeSection & {
  visible: boolean;
  // Section berbasis data tanpa item: tidak dirender di publik.
  empty: boolean;
};

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

// Konfigurasi pilihan (mode, limit, ids) tidak ikut ke respons publik.
const omitSelection = <T extends Selection>(content: T) => omitKeys(content, ["mode", "limit", "ids"] as const);

// Section yang dirender di beranda (tanpa type yang sudah dipensiunkan).
type ActiveHomeSectionContent = Exclude<HomeSectionContent, { type: RetiredHomeSectionType }>;
type Parsed = { row: HomeSection; section: ActiveHomeSectionContent };

const isActiveSection = (section: HomeSectionContent): section is ActiveHomeSectionContent =>
  !isRetiredHomeSectionType(section.type);

function selectionsOf<K extends ActiveHomeSectionContent["type"]>(parsed: Parsed[], type: K): { id: string; content: C<K> }[] {
  return parsed.flatMap(({ row, section }) =>
    section.type === type ? [{ id: row.id, content: section.content as C<K> }] : [],
  );
}

// Data semua section di-resolve sekaligus dengan jumlah query tetap: per entitas maksimal satu
// query untuk semua id manual + satu query mode auto (lihat resolveSelections), satu query jadwal,
// satu query media. Tidak bergantung jumlah section. Type yang dipensiunkan dilewati.
export async function resolveHomeSections(rows: HomeSection[], now = new Date()): Promise<PreviewHomeSection[]> {
  const parsed: Parsed[] = rows.flatMap((row) => {
    const section = parsedContent(row);
    return section && isActiveSection(section) ? [{ row, section }] : [];
  });
  const db = getDb();
  const today = appToday(now);
  const trainingWhere = publicTrainingWhere(now);

  const trainings = selectionsOf(parsed, "LATEST_TRAININGS");
  const schedules = selectionsOf(parsed, "UPCOMING_SCHEDULES");
  const clients = selectionsOf(parsed, "CLIENTS");
  const testimonials = selectionsOf(parsed, "TESTIMONIALS");
  const scheduleLimit = Math.max(0, ...schedules.map((item) => item.content.limit));

  const [trainingItems, scheduleRows, clientItems, testimonialItems, media] =
    await Promise.all([
      resolveSelections(
        trainings.map((item) => item.content),
        {
          byIds: (ids) => db.training.findMany({ where: { id: { in: ids }, ...trainingWhere }, include: cardInclude }),
          top: (limit) =>
            db.training.findMany({
              where: trainingWhere,
              include: cardInclude,
              orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
              take: limit,
            }),
          toItem: toCard,
        },
      ),
      // Jadwal terdekat: belum selesai menurut tanggal WIB (endDate >= hari ini), status DIBUKA/PENUH,
      // dari pelatihan publik.
      scheduleLimit
        ? db.schedule.findMany({
            where: {
              deletedAt: null,
              status: { in: ["OPEN", "FULL"] },
              endDate: { gte: today },
              training: trainingWhere,
            },
            include: publicScheduleInclude,
            orderBy: [{ startDate: "asc" }, { id: "asc" }],
            take: scheduleLimit,
          })
        : Promise.resolve([]),
      resolveSelections(
        clients.map((item) => item.content),
        {
          byIds: (ids) => db.client.findMany({ where: { id: { in: ids }, deletedAt: null }, include: { logo: true } }),
          top: (limit) =>
            db.client.findMany({
              where: { deletedAt: null },
              include: { logo: true },
              orderBy: [{ order: "asc" }, { name: "asc" }],
              take: limit,
            }),
          toItem: toPublicClient,
        },
      ),
      resolveSelections(
        testimonials.map((item) => item.content),
        {
          byIds: (ids) =>
            db.testimonial.findMany({ where: { id: { in: ids }, deletedAt: null }, include: { photo: true } }),
          top: (limit) =>
            db.testimonial.findMany({
              where: { deletedAt: null },
              include: { photo: true },
              orderBy: [{ order: "asc" }, { name: "asc" }],
              take: limit,
            }),
          toItem: toPublicTestimonial,
        },
      ),
      getMediaMap(parsed.flatMap(({ section }) => homeSectionMediaRefs(section).map((ref) => ref.mediaId))),
    ]);

  const itemsFor = <T,>(list: { id: string }[], resolved: T[][]) =>
    new Map(list.map((item, index) => [item.id, resolved[index] ?? []]));
  const trainingMap = itemsFor(trainings, trainingItems);
  const clientMap = itemsFor(clients, clientItems);
  const testimonialMap = itemsFor(testimonials, testimonialItems);
  const scheduleItems = scheduleRows.map((row) => toPublicSchedule(row, today));

  return parsed.map(({ row, section }): PreviewHomeSection => {
    const base = { id: row.id, visible: row.visible };
    switch (section.type) {
      case "HERO": {
        const { slides, ...rest } = section.content;
        const resolved = slides.flatMap((slide): PublicHeroSlide[] => {
          const item = media.get(slide.mediaId);
          const image = item?.mime.startsWith("image/") ? toPublicImage(item) : null;
          if (!image) return [];
          return [
            {
              image,
              alt: slide.alt || image.alt || "",
              caption: slide.caption,
              href: slide.href || null,
              hudLabel: slide.hudLabel,
              focalX: slide.focalX,
              focalY: slide.focalY,
            },
          ];
        });
        return { ...base, type: "HERO", ...rest, slides: resolved, empty: false };
      }
      case "VISION_MISSION":
        return { ...base, type: "VISION_MISSION", ...section.content, empty: false };
      case "CTA":
        return { ...base, type: "CTA", ...section.content, empty: false };
      case "LATEST_TRAININGS": {
        const items = trainingMap.get(row.id) ?? [];
        return { ...base, type: "LATEST_TRAININGS", ...omitSelection(section.content), items, empty: items.length === 0 };
      }
      case "UPCOMING_SCHEDULES": {
        const { limit, ...rest } = section.content;
        const items = scheduleItems.slice(0, limit);
        return { ...base, type: "UPCOMING_SCHEDULES", ...rest, items, empty: items.length === 0 };
      }
      case "CLIENTS": {
        const items = clientMap.get(row.id) ?? [];
        return { ...base, type: "CLIENTS", ...omitSelection(section.content), items, empty: items.length === 0 };
      }
      case "TESTIMONIALS": {
        const items = testimonialMap.get(row.id) ?? [];
        return { ...base, type: "TESTIMONIALS", ...omitSelection(section.content), items, empty: items.length === 0 };
      }
    }
  });
}

export type PublicHome = { sections: PublicHomeSection[] };

function withoutPreviewFlags(section: PreviewHomeSection): PublicHomeSection {
  return omitKeys(section, ["visible", "empty"] as const) as PublicHomeSection;
}

// Beranda publik: section tampil (visible) dan tidak kosong, sesuai urutan.
export async function getPublicHome(now = new Date()): Promise<PublicHome> {
  const rows = await getDb().homeSection.findMany({
    where: { deletedAt: null, visible: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  const sections = await resolveHomeSections(rows, now);
  return { sections: sections.filter((section) => !section.empty).map(withoutPreviewFlags) };
}

// Pratinjau admin (draft mode): semua section belum dihapus, termasuk yang disembunyikan & kosong.
export async function getHomePreview(now = new Date()): Promise<{ sections: PreviewHomeSection[] }> {
  const rows = await getDb().homeSection.findMany({
    where: { deletedAt: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return { sections: await resolveHomeSections(rows, now) };
}
