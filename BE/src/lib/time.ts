// Zona waktu bisnis (jadwal pelatihan, "hari ini", pergantian hari). Bukan env: semua jadwal
// ditulis dalam WIB.
export const APP_TIME_ZONE = "Asia/Jakarta";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// "2026-10-10" untuk saat `now` di WIB.
export function appDateString(now: Date = new Date()): string {
  return dateFormat.format(now);
}

// Tanggal hari ini (WIB) sebagai Date UTC tengah malam, sebanding dengan kolom @db.Date dari Prisma.
export function appToday(now: Date = new Date()): Date {
  return new Date(`${appDateString(now)}T00:00:00.000Z`);
}

// Kolom @db.Date -> "YYYY-MM-DD".
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// "2026-11" -> [awal bulan, awal bulan berikutnya) sebagai Date UTC (untuk kolom @db.Date).
export function monthRange(month: string): { start: Date; end: Date } {
  const [year, monthIndex] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, monthIndex - 1, 1)),
    end: new Date(Date.UTC(year, monthIndex, 1)),
  };
}
