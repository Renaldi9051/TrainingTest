import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { revalidateTags, RevalidateTag } from "@/lib/revalidate";
import {
  parseStoredSetting,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  settingMediaIds,
  settingSchemas,
  type SettingKey,
  type SettingValues,
} from "@/lib/validators/settings";
import { AuditAction, diffFields, writeAudit } from "@/services/audit";
import { assertImageMedia, getMediaMap, toPublicImage, type MediaDto, type PublicImage } from "@/services/media";

async function loadValues(): Promise<SettingValues> {
  const rows = await getDb().siteSetting.findMany({ where: { key: { in: SETTING_KEYS } } });
  const stored = new Map(rows.map((row) => [row.key, row.value]));
  return Object.fromEntries(
    SETTING_KEYS.map((key) => [key, parseStoredSetting(key, stored.get(key))]),
  ) as SettingValues;
}

function allMediaIds(values: SettingValues): string[] {
  return SETTING_KEYS.flatMap((key) =>
    Object.values(settingMediaIds(key, values[key])).filter((id): id is string => Boolean(id)),
  );
}

// ===== Admin =====

export type AdminSettings = { values: SettingValues; media: Record<string, MediaDto> };

export async function getAdminSettings(): Promise<AdminSettings> {
  const values = await loadValues();
  const media = await getMediaMap(allMediaIds(values));
  return { values, media: Object.fromEntries(media) };
}

export async function updateSetting<K extends SettingKey>(
  key: K,
  input: unknown,
  userId: string,
): Promise<AdminSettings> {
  const value = settingSchemas[key].parse(input) as SettingValues[K];
  await assertImageMedia(settingMediaIds(key, value));

  const db = getDb();
  const before = await db.siteSetting.findUnique({ where: { key } });
  const previous = before ? parseStoredSetting(key, before.value) : SETTING_DEFAULTS[key];
  const json = value as unknown as Prisma.InputJsonValue;

  await db.$transaction(async (tx) => {
    const saved = await tx.siteSetting.upsert({
      where: { key },
      update: { value: json, updatedBy: { connect: { id: userId } } },
      create: { key, value: json, updatedBy: { connect: { id: userId } } },
    });
    const fields = Object.keys(value) as (keyof SettingValues[K] & string)[];
    await writeAudit(
      {
        userId,
        action: before ? AuditAction.UPDATE : AuditAction.CREATE,
        entity: "SiteSetting",
        entityId: saved.id,
        diff: { key, changes: diffFields(previous, value, fields) } as Prisma.InputJsonValue,
      },
      tx,
    );
  });

  await revalidateTags([RevalidateTag.SETTINGS]);
  return getAdminSettings();
}

// ===== Publik =====

export type PublicSettings = {
  identity: {
    name: string;
    tagline: string;
    logoLight: PublicImage | null;
    logoDark: PublicImage | null;
    favicon: PublicImage | null;
  };
  header: SettingValues["site.header"];
  contact: Omit<SettingValues["site.contact"], "whatsapp"> & {
    whatsapp: string;
    whatsappUrl: string | null;
  };
  social: SettingValues["site.social"];
  footer: SettingValues["site.footer"];
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    description: string;
    ogImage: PublicImage | null;
  };
};

export function whatsappUrl(number: string, message?: string): string | null {
  if (!number) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${number}${text}`;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const values = await loadValues();
  const media = await getMediaMap(allMediaIds(values));
  const image = (id: string | null) => toPublicImage(id ? media.get(id) : null);
  const identity = values["site.identity"];
  const contact = values["site.contact"];
  const seo = values["seo.default"];

  return {
    identity: {
      name: identity.name,
      tagline: identity.tagline,
      logoLight: image(identity.logoLightId),
      logoDark: image(identity.logoDarkId),
      favicon: image(identity.faviconId),
    },
    header: values["site.header"],
    contact: { ...contact, whatsappUrl: whatsappUrl(contact.whatsapp) },
    social: values["site.social"],
    footer: values["site.footer"],
    seo: {
      titleTemplate: seo.titleTemplate,
      defaultTitle: seo.defaultTitle || identity.name,
      description: seo.description,
      ogImage: image(seo.ogImageId),
    },
  };
}

// Default detail pelatihan (fasilitas, FAQ global, catatan in-house, disclaimer).
export async function getTrainingDefaults(): Promise<SettingValues["training.defaults"]> {
  const row = await getDb().siteSetting.findUnique({ where: { key: "training.defaults" } });
  return parseStoredSetting("training.defaults", row?.value);
}
