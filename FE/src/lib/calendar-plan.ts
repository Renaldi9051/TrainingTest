// Kalender bulanan /jadwal (mockup jadwal.html): minggu mulai Senin, sesi ditaruh di tanggal mulai,
// rentang hari ditulis di teks. Tanggal "YYYY-MM-DD" diperlakukan sebagai tanggal kalender (UTC).
// Fungsi murni, dites di Vitest.

export type CalendarCell = { date: string; day: number; inMonth: boolean };

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parseMonth(month: string): { year: number; index: number } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) throw new Error(`Bulan tidak valid: ${month}`);
  return { year: Number(match[1]), index: Number(match[2]) - 1 };
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

// Sel kalender penuh per minggu (Senin-Minggu), termasuk hari bulan sebelum/sesudah sebagai pengisi.
export function monthCells(month: string): CalendarCell[] {
  const { year, index } = parseMonth(month);
  const first = new Date(Date.UTC(year, index, 1));
  // getUTCDay: 0 = Minggu. Geser supaya Senin = 0.
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
  const total = Math.ceil((lead + daysInMonth) / 7) * 7;
  return Array.from({ length: total }, (_, offset) => {
    const date = new Date(Date.UTC(year, index, 1 - lead + offset));
    return { date: iso(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === index };
  });
}

export function weeksOf<T>(cells: T[]): T[][] {
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export function shiftMonth(month: string, delta: number): string {
  const { year, index } = parseMonth(month);
  return iso(new Date(Date.UTC(year, index + delta, 1))).slice(0, 7);
}

export function monthLabel(month: string): string {
  const { year, index } = parseMonth(month);
  return new Date(Date.UTC(year, index, 1)).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}

const shortMonth = (date: Date) =>
  date.toLocaleDateString("id-ID", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();

// "12-14 NOV", "30 NOV-2 DES", "12 NOV" (satu hari).
export function rangeLabel(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (start === end) return `${s.getUTCDate()} ${shortMonth(s)}`;
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) {
    return `${s.getUTCDate()}-${e.getUTCDate()} ${shortMonth(e)}`;
  }
  return `${s.getUTCDate()} ${shortMonth(s)}-${e.getUTCDate()} ${shortMonth(e)}`;
}

// Sesi dikelompokkan per tanggal mulai (urutan masukan dijaga).
export function byStartDate<T extends { startDate: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(item.startDate, [...(map.get(item.startDate) ?? []), item]);
  return map;
}
