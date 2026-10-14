import { ADMIN_MODULES, adminModuleHref } from "@/lib/admin-nav";
import type { AdminSearchGroup, AdminSearchItem, AdminSearchResult, HomeSectionType } from "@/lib/api/types";
import type { PaletteGroup, PaletteItem } from "@/lib/command-palette";
import { HOME_SECTION_LABELS } from "@/lib/home-sections";
import { findSettingField, SETTING_FIELDS, SETTING_TAB_LABELS, settingFieldHref } from "@/lib/settings-fields";
import { matchesAllWords } from "@/lib/text-match";

// Search global admin (Ctrl/Cmd+K): hasil BE (GET /api/admin/search) + modul dan field pengaturan
// yang dicari di klien. URL tujuan dibentuk di sini (FE yang tahu route admin).

export const ADMIN_SEARCH_MIN = 2;
const MAX_CLIENT_ITEMS = 5;
const MAX_SETTINGS_ITEMS = 6;

export const ADMIN_SEARCH_GROUP_LABELS: Record<AdminSearchGroup, string> = {
  trainings: "Pelatihan",
  categories: "Kategori",
  services: "Layanan",
  pages: "Halaman",
  home: "Section beranda",
  portfolio: "Portofolio",
  clients: "Klien",
  testimonials: "Testimoni",
  marketing: "Kontak marketing",
  mediaPartners: "Media partner",
  media: "Media",
  navigation: "Navigasi",
  settings: "Pengaturan",
};

// Halaman tujuan tiap hasil. Entitas yang diedit lewat dialog dibuka dengan ?edit=<id>.
export function adminSearchHref(group: AdminSearchGroup, item: AdminSearchItem): string {
  const id = encodeURIComponent(item.id);
  switch (group) {
    case "trainings":
    case "categories":
    case "services":
    case "pages":
    case "portfolio":
      return `/admin/${group}/${id}`;
    case "home":
      return `/admin/home/${id}`;
    case "clients":
    case "testimonials":
    case "marketing":
      return `/admin/${group}?edit=${id}`;
    case "mediaPartners":
      return `/admin/media-partners?edit=${id}`;
    case "media":
      return `/admin/media?media=${id}`;
    case "navigation":
      return "/admin/navigation";
    case "settings": {
      const field = item.field ? findSettingField(item.id, item.field) : undefined;
      return field ? settingFieldHref(field.key, field.field) : "/admin/settings";
    }
  }
}

const sectionLabel = (value: string) => HOME_SECTION_LABELS[value as HomeSectionType] ?? value;

function toPaletteItem(group: AdminSearchGroup, item: AdminSearchItem): PaletteItem {
  const home = group === "home";
  return {
    key: `${group}:${item.id}:${item.field ?? ""}`,
    href: adminSearchHref(group, item),
    title: home ? sectionLabel(item.title) : item.title,
    meta: home && item.meta ? sectionLabel(item.meta) : item.meta,
    badge: item.status === "DRAFT" ? "Draf" : null,
  };
}

function moduleItems(query: string): PaletteItem[] {
  return ADMIN_MODULES.filter((adminModule) => adminModule.available && matchesAllWords(query, [adminModule.label]))
    .slice(0, MAX_CLIENT_ITEMS)
    .map((adminModule) => ({
      key: `module:${adminModule.slug}`,
      href: adminModuleHref(adminModule),
      title: adminModule.label,
      meta: null,
    }));
}

// Field pengaturan dari label/sinonim (klien) digabung dengan nilai pengaturan yang cocok (BE).
// Field yang muncul di keduanya tampil sekali, dengan potongan nilainya.
function settingItems(query: string, valueHits: readonly AdminSearchItem[]): PaletteItem[] {
  const items = new Map<string, PaletteItem>();
  for (const field of SETTING_FIELDS) {
    if (!matchesAllWords(query, [field.label, ...field.synonyms])) continue;
    const href = settingFieldHref(field.key, field.field);
    items.set(href, { key: `setting:${href}`, href, title: field.label, meta: SETTING_TAB_LABELS[field.key] });
  }
  for (const hit of valueHits) {
    const field = hit.field ? findSettingField(hit.id, hit.field) : undefined;
    if (!field) continue;
    const href = settingFieldHref(field.key, field.field);
    items.set(href, { key: `setting:${href}`, href, title: field.label, meta: hit.title });
  }
  return [...items.values()].slice(0, MAX_SETTINGS_ITEMS);
}

// Urutan: modul, pengaturan, lalu konten (urutan grup dari BE). Grup kosong tidak ditampilkan.
export function buildAdminPaletteGroups(query: string, result: AdminSearchResult | undefined): PaletteGroup[] {
  if (query.trim().length < ADMIN_SEARCH_MIN) return [];
  const backend = result?.groups ?? [];
  const settingsHits = backend.find((group) => group.group === "settings")?.items ?? [];
  const groups: PaletteGroup[] = [
    { id: "modules", label: "Modul", items: moduleItems(query) },
    { id: "settings", label: ADMIN_SEARCH_GROUP_LABELS.settings, items: settingItems(query, settingsHits) },
    ...backend
      .filter((group) => group.group !== "settings")
      .map((group) => ({
        id: group.group,
        label: ADMIN_SEARCH_GROUP_LABELS[group.group],
        items: group.items.map((item) => toPaletteItem(group.group, item)),
      })),
  ];
  return groups.filter((group) => group.items.length > 0);
}
