import { describe, expect, it } from "vitest";
import { csvCell, CsvError, parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("header lower-case, sel di-trim, baris kosong dilewati, nomor baris asli", () => {
    const result = parseCsv("Training_Slug,City\r\nabc , Jakarta\r\n\r\ndef,Bandung\r\n");
    expect(result.header).toEqual(["training_slug", "city"]);
    expect(result.rows).toEqual([
      { line: 2, cells: ["abc", "Jakarta"] },
      { line: 4, cells: ["def", "Bandung"] },
    ]);
  });

  it("kutip ganda, koma & baris baru di dalam kutip, kutip yang di-escape", () => {
    const result = parseCsv('a,b\n"Jl. Contoh, No. 1","Ruang ""A""\nlantai 2"\nx,y');
    expect(result.rows[0]).toEqual({ line: 2, cells: ["Jl. Contoh, No. 1", 'Ruang "A"\nlantai 2'] });
    expect(result.rows[1]).toEqual({ line: 4, cells: ["x", "y"] });
  });

  it("deteksi titik koma (Excel Indonesia) dan buang BOM", () => {
    const result = parseCsv("﻿training_slug;price\nabc;4.500.000\n");
    expect(result.delimiter).toBe(";");
    expect(result.header).toEqual(["training_slug", "price"]);
    expect(result.rows[0].cells).toEqual(["abc", "4.500.000"]);
  });

  it("kutip tidak ditutup = error dengan nomor baris", () => {
    expect(() => parseCsv('a,b\n"tidak ditutup,x')).toThrow(CsvError);
  });

  it("csvCell meng-escape nilai yang perlu kutip", () => {
    expect(csvCell('Ruang "A", lt 2')).toBe('"Ruang ""A"", lt 2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(4500000)).toBe("4500000");
  });
});
