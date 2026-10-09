import { csvCell, CsvError, parseCsv } from "@/lib/csv";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { revalidateTags, RevalidateTag, tags } from "@/lib/revalidate";
import { isValidDateString, MAX_IMPORT_ROWS, type ScheduleImportInput } from "@/lib/validators/schedule";
import { AuditAction, writeAudit } from "@/services/audit";

// Import jadwal dari CSV. Pelatihan dicocokkan lewat slug. Preview per baris dulu (dryRun),
// simpan hanya kalau SEMUA baris valid, dalam satu transaksi.

export const IMPORT_COLUMNS = [
  "training_slug",
  "start_date",
  "end_date",
  "city",
  "venue",
  "method",
  "price",
  "status",
] as const;

type Column = (typeof IMPORT_COLUMNS)[number];
const REQUIRED_COLUMNS: Column[] = ["training_slug", "start_date", "end_date", "method"];

const METHODS: Record<string, "ONLINE" | "OFFLINE" | "HYBRID"> = {
  online: "ONLINE",
  offline: "OFFLINE",
  hybrid: "HYBRID",
};

const STATUSES: Record<string, "OPEN" | "FULL" | "COMPLETED"> = {
  "": "OPEN",
  dibuka: "OPEN",
  open: "OPEN",
  penuh: "FULL",
  full: "FULL",
  selesai: "COMPLETED",
  completed: "COMPLETED",
};

export type ImportRowData = {
  trainingId: string;
  trainingTitle: string;
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: "ONLINE" | "OFFLINE" | "HYBRID";
  price: number | null;
  status: "OPEN" | "FULL" | "COMPLETED";
};

export type ImportRowResult = {
  line: number;
  values: Record<Column, string>;
  errors: string[];
  data: ImportRowData | null;
};

export type ImportPreview = {
  rows: ImportRowResult[];
  validCount: number;
  invalidCount: number;
  created: number;
};

export type TrainingLookup = Map<string, { id: string; title: string }>;

// "Rp4.500.000", "4,500,000", "4500000" -> 4500000. Kosong -> null.
export function parsePrice(value: string): number | null | "invalid" {
  const cleaned = value.replace(/^rp\.?\s*/i, "").replace(/[\s.,]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+$/.test(cleaned) || cleaned.length > 11) return "invalid";
  return Number(cleaned);
}

export function readImportCsv(csv: string): { header: string[]; rows: { line: number; values: Record<Column, string> }[] } {
  let parsed;
  try {
    parsed = parseCsv(csv);
  } catch (error) {
    if (error instanceof CsvError) {
      throw new HttpError(422, "INVALID_CSV", `CSV tidak valid (baris ${error.line}): ${error.message}`);
    }
    throw error;
  }
  const unknown = parsed.header.filter((name) => !(IMPORT_COLUMNS as readonly string[]).includes(name));
  const missing = REQUIRED_COLUMNS.filter((name) => !parsed.header.includes(name));
  if (missing.length > 0 || unknown.length > 0) {
    const parts = [
      missing.length > 0 ? `kolom wajib tidak ada: ${missing.join(", ")}` : null,
      unknown.length > 0 ? `kolom tidak dikenal: ${unknown.join(", ")}` : null,
    ].filter(Boolean);
    throw new HttpError(
      422,
      "INVALID_CSV_HEADER",
      `Header CSV tidak sesuai template (${parts.join("; ")}). Unduh template lalu salin datanya.`,
    );
  }
  if (parsed.rows.length === 0) throw new HttpError(422, "EMPTY_CSV", "CSV tidak berisi baris data.");
  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new HttpError(422, "TOO_MANY_ROWS", `Maksimal ${MAX_IMPORT_ROWS} baris per import.`);
  }

  return {
    header: parsed.header,
    rows: parsed.rows.map((row) => ({
      line: row.line,
      values: Object.fromEntries(
        IMPORT_COLUMNS.map((column) => {
          const index = parsed.header.indexOf(column);
          return [column, index >= 0 ? (row.cells[index] ?? "") : ""];
        }),
      ) as Record<Column, string>,
    })),
  };
}

export function validateImportRows(
  rows: { line: number; values: Record<Column, string> }[],
  trainings: TrainingLookup,
): ImportRowResult[] {
  const seen = new Map<string, number>();
  return rows.map(({ line, values }) => {
    const errors: string[] = [];
    const training = trainings.get(values.training_slug.toLowerCase());
    if (!values.training_slug) errors.push("training_slug wajib diisi.");
    else if (!training) errors.push(`Pelatihan dengan slug "${values.training_slug}" tidak ditemukan.`);

    const startOk = isValidDateString(values.start_date);
    const endOk = isValidDateString(values.end_date);
    if (!startOk) errors.push("start_date harus YYYY-MM-DD dan tanggalnya ada.");
    if (!endOk) errors.push("end_date harus YYYY-MM-DD dan tanggalnya ada.");
    if (startOk && endOk && values.end_date < values.start_date) {
      errors.push("end_date tidak boleh sebelum start_date.");
    }

    const method = METHODS[values.method.toLowerCase()];
    if (!method) errors.push("method harus online, offline, atau hybrid.");
    const status = STATUSES[values.status.toLowerCase()];
    if (!status) errors.push("status harus DIBUKA, PENUH, atau SELESAI (kosong = DIBUKA).");
    const price = parsePrice(values.price);
    if (price === "invalid") errors.push("price harus angka Rupiah tanpa desimal, mis. 4500000.");
    if (values.city.length > 100) errors.push("city maksimal 100 karakter.");
    if (values.venue.length > 200) errors.push("venue maksimal 200 karakter.");

    const key = [values.training_slug.toLowerCase(), values.start_date, values.end_date, values.city.toLowerCase()].join("|");
    const duplicateOf = seen.get(key);
    if (duplicateOf !== undefined) errors.push(`Duplikat dengan baris ${duplicateOf}.`);
    else seen.set(key, line);

    const data: ImportRowData | null =
      errors.length === 0 && training && method && status && price !== "invalid"
        ? {
            trainingId: training.id,
            trainingTitle: training.title,
            startDate: values.start_date,
            endDate: values.end_date,
            city: values.city || null,
            venue: values.venue || null,
            method,
            price,
            status,
          }
        : null;
    return { line, values, errors, data };
  });
}

export async function importSchedules(input: ScheduleImportInput, userId: string): Promise<ImportPreview> {
  const { rows } = readImportCsv(input.csv);
  const slugs = [...new Set(rows.map((row) => row.values.training_slug.toLowerCase()).filter(Boolean))];
  const trainings = await getDb().training.findMany({
    where: { slug: { in: slugs }, deletedAt: null },
    select: { id: true, slug: true, title: true },
  });
  const lookup: TrainingLookup = new Map(trainings.map((row) => [row.slug, { id: row.id, title: row.title }]));
  const results = validateImportRows(rows, lookup);
  const valid = results.flatMap((row) => (row.data ? [row.data] : []));
  const preview: ImportPreview = {
    rows: results,
    validCount: valid.length,
    invalidCount: results.length - valid.length,
    created: 0,
  };

  if (input.dryRun) return preview;
  if (preview.invalidCount > 0) {
    throw new HttpError(
      422,
      "IMPORT_INVALID",
      `${preview.invalidCount} baris tidak valid. Perbaiki CSV lalu coba lagi; tidak ada data yang disimpan.`,
      undefined,
      preview,
    );
  }

  await getDb().$transaction(async (tx) => {
    await tx.schedule.createMany({
      data: valid.map((row) => ({
        trainingId: row.trainingId,
        startDate: new Date(`${row.startDate}T00:00:00.000Z`),
        endDate: new Date(`${row.endDate}T00:00:00.000Z`),
        city: row.city,
        venue: row.venue,
        method: row.method,
        price: row.price,
        status: row.status,
        updatedById: userId,
      })),
    });
    await writeAudit(
      {
        userId,
        action: AuditAction.IMPORT,
        entity: "Schedule",
        diff: { rows: valid.length, trainings: [...new Set(valid.map((row) => row.trainingId))] },
      },
      tx,
    );
  });

  const importedSlugs = trainings
    .filter((training) => valid.some((row) => row.trainingId === training.id))
    .map((training) => RevalidateTag.training(training.slug));
  await revalidateTags(tags(RevalidateTag.SCHEDULES, ...importedSlugs));
  return { ...preview, created: valid.length };
}

// Template CSV yang bisa diunduh admin. Slug contoh diambil dari pelatihan yang ada.
export function scheduleImportTemplate(exampleSlug: string): string {
  const rows = [
    [...IMPORT_COLUMNS],
    [exampleSlug, "2026-11-17", "2026-11-18", "Jakarta", "Ruang pelatihan, Jakarta Selatan", "offline", "4500000", "DIBUKA"],
    [exampleSlug, "2026-12-08", "2026-12-08", "", "Zoom", "online", "", "DIBUKA"],
  ];
  return `${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
