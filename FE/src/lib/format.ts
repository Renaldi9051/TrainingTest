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

const inputParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// ISO -> nilai <input type="datetime-local"> dalam WIB ("2026-11-01T09:00").
export function toWibInputValue(iso: string | null): string {
  if (!iso) return "";
  const parts = Object.fromEntries(inputParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Nilai datetime-local (dibaca sebagai WIB) -> ISO dengan offset +07:00. Kosong -> null.
export function fromWibInputValue(value: string): string | null {
  if (!value) return null;
  return `${value.length === 16 ? `${value}:00` : value}+07:00`;
}

// "2026-11-17" & "2026-11-18" -> "17-18 Nov 2026"; lintas bulan/tahun ditulis lengkap.
export function formatDateRange(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const day = (date: Date) => date.getUTCDate();
  const month = (date: Date) => date.toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" });
  const year = (date: Date) => date.getUTCFullYear();
  if (start === end) return `${day(s)} ${month(s)} ${year(s)}`;
  if (year(s) === year(e) && s.getUTCMonth() === e.getUTCMonth()) return `${day(s)}-${day(e)} ${month(e)} ${year(e)}`;
  if (year(s) === year(e)) return `${day(s)} ${month(s)} - ${day(e)} ${month(e)} ${year(e)}`;
  return `${day(s)} ${month(s)} ${year(s)} - ${day(e)} ${month(e)} ${year(e)}`;
}
