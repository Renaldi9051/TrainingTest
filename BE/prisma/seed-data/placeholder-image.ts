// Gambar placeholder untuk data contoh: dibuat lokal saat seed (tanpa file biner di repo, tanpa aset
// dari website referensi). Monokrom datar (DESIGN 2 & 5): latar abu, beberapa bentuk geometris abu,
// dan noise halus supaya ukuran WebP mendekati foto. Tanpa gradasi. Deterministik per `seed`.
import sharp from "sharp";

// Abu netral dari palet token (DESIGN 2), tanpa hitam/putih penuh supaya tidak terlalu kontras.
export const PLACEHOLDER_GRAYS = ["#ebebeb", "#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373", "#525252", "#404040"] as const;

export const PLACEHOLDER_WIDTH = 1600;
export const PLACEHOLDER_HEIGHT = 1200;
// Amplitudo noise per piksel (0-255).
const NOISE = 7;

// PRNG kecil (mulberry32): hasil sama untuk seed yang sama di semua mesin.
export function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number) => Math.round(value);

// Komposisi SVG: latar datar + 3-5 bentuk (persegi, lingkaran, segitiga, pita miring).
export function placeholderSvg(seed: number, width = PLACEHOLDER_WIDTH, height = PLACEHOLDER_HEIGHT): string {
  const random = prng(seed);
  const pick = () => PLACEHOLDER_GRAYS[Math.floor(random() * PLACEHOLDER_GRAYS.length)];
  const background = PLACEHOLDER_GRAYS[Math.floor(random() * 3)];
  const shapes: string[] = [];
  const count = 3 + Math.floor(random() * 3);
  for (let index = 0; index < count; index += 1) {
    const fill = pick();
    const x = round(random() * width);
    const y = round(random() * height);
    const size = round((0.18 + random() * 0.4) * Math.min(width, height));
    switch (Math.floor(random() * 4)) {
      case 0:
        shapes.push(`<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${round(size * (0.5 + random()))}" fill="${fill}"/>`);
        break;
      case 1:
        shapes.push(`<circle cx="${x}" cy="${y}" r="${round(size / 2)}" fill="${fill}"/>`);
        break;
      case 2:
        shapes.push(`<polygon points="${x},${y - size / 2} ${x + size / 2},${y + size / 2} ${x - size / 2},${y + size / 2}" fill="${fill}"/>`);
        break;
      default: {
        const angle = round(random() * 180);
        shapes.push(`<rect x="${-width}" y="${y}" width="${width * 3}" height="${round(size / 4)}" fill="${fill}" transform="rotate(${angle} ${x} ${y})"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${background}"/>${shapes.join("")}</svg>`;
}

// SVG -> PNG grayscale dengan noise halus (deterministik). Dipakai sebagai input upload biasa.
export async function placeholderPng(seed: number, width = PLACEHOLDER_WIDTH, height = PLACEHOLDER_HEIGHT): Promise<Buffer> {
  const { data, info } = await sharp(Buffer.from(placeholderSvg(seed, width, height)))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const random = prng(seed ^ 0x9e3779b9);
  // Noise sama di semua kanal warna supaya tetap abu (alpha tidak disentuh).
  const channels = info.channels;
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    const delta = round((random() * 2 - 1) * NOISE);
    for (let channel = 0; channel < Math.min(channels, 3); channel += 1) {
      const offset = pixel * channels + channel;
      data[offset] = Math.max(0, Math.min(255, data[offset] + delta));
    }
  }
  // Tanpa kompresi: PNG ini hanya input sementara untuk jalur upload (dikonversi ke WebP).
  return sharp(data, { raw: { width: info.width, height: info.height, channels } }).png({ compressionLevel: 0 }).toBuffer();
}
