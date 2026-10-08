import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectFileType, looksLikeSvg } from "@/lib/file-type";

const encoder = new TextEncoder();

async function png() {
  return new Uint8Array(
    await sharp({ create: { width: 4, height: 4, channels: 3, background: "#808080" } })
      .png()
      .toBuffer(),
  );
}

describe("detectFileType", () => {
  it("mengenali PNG dan JPEG dari isi file", async () => {
    expect(await detectFileType(await png())).toEqual({ kind: "raster", mime: "image/png" });
    const jpeg = await sharp(await png()).jpeg().toBuffer();
    expect(await detectFileType(new Uint8Array(jpeg))).toEqual({
      kind: "raster",
      mime: "image/jpeg",
    });
  });

  it("menolak file palsu walau namanya .jpg (isi teks biasa)", async () => {
    // Nama/ekstensi tidak pernah dipakai; yang dicek hanya isi.
    const fakeJpg = encoder.encode("ini bukan gambar, hanya teks yang diberi nama foto.jpg");
    expect(await detectFileType(fakeJpg)).toBeNull();
  });

  it("menolak executable dan arsip yang menyamar", async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, ...new Array(64).fill(0)]);
    expect(await detectFileType(exe)).toBeNull();
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(64).fill(0)]);
    expect(await detectFileType(zip)).toBeNull();
  });

  it("mengenali PDF", async () => {
    const pdf = encoder.encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
    expect(await detectFileType(pdf)).toEqual({ kind: "pdf", mime: "application/pdf" });
  });

  it("mengenali SVG dari isi teks", async () => {
    const svg = encoder.encode('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(await detectFileType(svg)).toEqual({ kind: "svg", mime: "image/svg+xml" });
  });
});

describe("looksLikeSvg", () => {
  it("menolak HTML biasa dan data biner", () => {
    expect(looksLikeSvg(encoder.encode("<html><body><svg></svg></body></html>"))).toBe(false);
    expect(looksLikeSvg(new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0x00]))).toBe(false);
  });
});
