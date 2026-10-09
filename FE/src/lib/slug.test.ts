import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";

// Harus sama dengan BE/src/lib/slug.test.ts supaya pratinjau slug di form cocok dengan hasil BE.
describe("slugify (FE)", () => {
  it.each([
    ["Analisis Laporan Keuangan", "analisis-laporan-keuangan"],
    ["  Manajemen   Kinerja (KPI)  ", "manajemen-kinerja-kpi"],
    ["Café Résumé Naïve", "cafe-resume-naive"],
    ["Keuangan & Akuntansi", "keuangan-dan-akuntansi"],
    ["ISO 9001:2015 -- Dasar", "iso-9001-2015-dasar"],
  ])("%s -> %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});
