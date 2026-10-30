import type { ImageLoaderProps } from "next/image";

// Lebar varian yang dibuat BE (BE/src/lib/image.ts). images.deviceSizes di next.config = varian ini + 2400
// (lebih lebar dari varian terbesar -> file utama).
export const MEDIA_VARIANT_WIDTHS = [320, 768, 1600] as const;

// File WebP utama: relatif di /uploads (penyimpanan disk BE), atau URL absolut bucket R2 dengan nama
// file buatan BE (yyyy/mm/<uuid>.webp). Grup 1 = URL tanpa ".webp".
const MAIN_WEBP =
  /^(\/uploads\/.+?|https?:\/\/[^/?#]+\/(?:[^?#]*\/)?\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?<!-(?:320|768|1600))\.webp$/;

// Loader next/image untuk media dari BE: memilih varian WebP buatan sharp terkecil yang cukup lebar.
// Tidak memakai optimizer Next, jadi tidak ada proses gambar ulang di server FE.
// Selain WebP utama (mis. SVG), pakai prop `unoptimized` di <Image>.
export default function mediaImageLoader({ src, width }: ImageLoaderProps): string {
  const match = MAIN_WEBP.exec(src);
  if (!match) return src;
  const variant = MEDIA_VARIANT_WIDTHS.find((variantWidth) => width <= variantWidth);
  return variant ? `${match[1]}-${variant}.webp` : src;
}
