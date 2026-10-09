// Format tanggal & angka untuk UI (Bahasa Indonesia, zona waktu WIB).
export const APP_TIME_ZONE = "Asia/Jakarta";

const dateTimeFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: APP_TIME_ZONE,
});

const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: APP_TIME_ZONE });

export function formatDateTime(value: string | Date): string {
  return dateTimeFormat.format(new Date(value));
}

export function formatDate(value: string | Date): string {
  return dateFormat.format(new Date(value));
}

const numberFormat = new Intl.NumberFormat("id-ID");

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatRupiah(value: number): string {
  return `Rp${numberFormat.format(value)}`;
}
