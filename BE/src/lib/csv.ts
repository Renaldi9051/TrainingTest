// Parser CSV kecil (RFC 4180): kutip ganda, "" di dalam kutip, koma/titik koma, CRLF/LF, BOM.
// Pemisah dideteksi dari baris header: Excel versi Indonesia menyimpan CSV dengan titik koma.

export type CsvRow = { line: number; cells: string[] };

export type CsvParseResult = { header: string[]; rows: CsvRow[]; delimiter: "," | ";" };

export class CsvError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = "CsvError";
  }
}

function detectDelimiter(text: string): "," | ";" {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(input: string): CsvParseResult {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const records: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  const pushRecord = () => {
    cells.push(cell);
    // Baris kosong (mis. baris terakhir) dilewati.
    if (!(cells.length === 1 && cells[0].trim() === "")) records.push({ line: recordLine, cells });
    cells = [];
    cell = "";
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      inQuotes = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (char === "\r" && text[index + 1] === "\n") {
      // CRLF: ditangani di \n.
    } else if (char === "\n" || char === "\r") {
      pushRecord();
      line += 1;
      recordLine = line;
    } else {
      cell += char;
    }
  }
  if (inQuotes) throw new CsvError("Tanda kutip tidak ditutup.", recordLine);
  if (cell !== "" || cells.length > 0) pushRecord();

  const [headerRow, ...rows] = records;
  if (!headerRow) throw new CsvError("File CSV kosong.", 1);
  return {
    header: headerRow.cells.map((name) => name.trim().toLowerCase()),
    rows: rows.map((row) => ({ line: row.line, cells: row.cells.map((value) => value.trim()) })),
    delimiter,
  };
}

// Escape satu nilai untuk ditulis ke CSV.
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
