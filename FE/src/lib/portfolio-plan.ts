import type { PortfolioActivityType, PublicPortfolioItem } from "@/lib/api/types";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_PARAMS } from "@/lib/labels";

// Filter jenis kegiatan /profil/portofolio (?jenis=lapangan) dan pola grid asimetris (mockup
// portofolio.html). Fungsi murni, dites di Vitest.

const ORDER = Object.keys(ACTIVITY_TYPE_LABELS) as PortfolioActivityType[];

export function parseActivityParam(value: string | string[] | undefined): PortfolioActivityType | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return ORDER.find((type) => ACTIVITY_TYPE_PARAMS[type] === raw) ?? null;
}

// Chip hanya untuk jenis yang punya minimal 1 item; kosong semua = baris chip disembunyikan.
export function availableActivityTypes(items: Pick<PublicPortfolioItem, "activityType">[]): PortfolioActivityType[] {
  const present = new Set(items.map((item) => item.activityType).filter((type): type is PortfolioActivityType => type !== null));
  return ORDER.filter((type) => present.has(type));
}

export function filterPortfolio<T extends Pick<PublicPortfolioItem, "activityType">>(items: T[], type: PortfolioActivityType | null): T[] {
  return type ? items.filter((item) => item.activityType === type) : items;
}

export function activityHref(type: PortfolioActivityType | null): string {
  return type ? `/profil/portofolio?jenis=${ACTIVITY_TYPE_PARAMS[type]}` : "/profil/portofolio";
}

// Lebar kolom (dari 12) per kartu: pola 7-5 / 4-4-4 / 5-7 / 6 bergantian; saat difilter semua 4.
const SPANS = [7, 5, 4, 4, 4, 5, 7, 6] as const;
export type CardSpan = 4 | 5 | 6 | 7;

export function cardSpan(index: number, filtered: boolean): CardSpan {
  return filtered ? 4 : SPANS[index % SPANS.length];
}
