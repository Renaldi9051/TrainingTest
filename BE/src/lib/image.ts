import sharp, { type Sharp } from "sharp";

export const VARIANT_WIDTHS = [320, 768, 1600] as const;
export type VariantWidth = (typeof VARIANT_WIDTHS)[number];

export type EncodedImage = { data: Buffer; width: number; height: number; size: number };

export type ProcessedImage = {
  main: EncodedImage;
  variants: Record<VariantWidth, EncodedImage>;
};

// Batas piksel input untuk mencegah decompression bomb (mis. PNG kecil berdimensi raksasa).
const MAX_INPUT_PIXELS = 50_000_000;

async function encode(pipeline: Sharp, quality: number): Promise<EncodedImage> {
  const { data, info } = await pipeline.webp({ quality }).toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, size: info.size };
}

// Gambar raster -> WebP ukuran asli + varian 320/768/1600. Tanpa upscale: gambar yang lebih kecil
// dari lebar varian disimpan dengan ukuran aslinya. Orientasi EXIF diterapkan, metadata dibuang.
export async function processRasterImage(input: Uint8Array): Promise<ProcessedImage> {
  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).rotate();

  const main = await encode(base.clone(), 82);
  const encoded = await Promise.all(
    VARIANT_WIDTHS.map((width) =>
      encode(base.clone().resize({ width, withoutEnlargement: true }), 80),
    ),
  );

  return {
    main,
    variants: { 320: encoded[0], 768: encoded[1], 1600: encoded[2] },
  };
}

// Dimensi SVG (dari width/height atau viewBox) kalau bisa dibaca; null kalau tidak.
export async function readSvgSize(svg: string): Promise<{ width: number; height: number } | null> {
  try {
    const { width, height } = await sharp(Buffer.from(svg)).metadata();
    return width && height ? { width, height } : null;
  } catch {
    return null;
  }
}
