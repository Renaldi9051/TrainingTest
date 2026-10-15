// Teks outline raksasa dari eyebrow section (CMS) tanpa nomor urut: "01 / Layanan" -> "Layanan".
export function outlineLabel(eyebrow: string): string {
  return eyebrow.replace(/^\s*\d+\s*\/\s*/, "").trim();
}
