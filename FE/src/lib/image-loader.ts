import type { ImageLoaderProps } from "next/image";

// Lebar varian yang dibuat BE (BE/src/lib/image.ts). Harus sama dengan images.deviceSizes di next.config.
export const MEDIA_VARIANT_WIDTHS = [320, 768, 1600] as const;

const MAIN_WEBP = /^\/uploads\/(.+?)(?<!-(?:320|768|1600))\.webp$/;

// Loader next/image untuk media dari BE: memilih varian WebP buatan sharp terkecil yang cukup lebar.
// Tidak memakai optimizer Next, jadi tidak ada proses gambar ulang di server FE.
// Selain WebP utama di /uploads (mis. SVG), pakai prop `unoptimized` di <Image>.
export default function mediaImageLoader({ src, width }: ImageLoaderProps): string {
  const match = MAIN_WEBP.exec(src);
  if (!match) return src;
  const variant = MEDIA_VARIANT_WIDTHS.find((variantWidth) => width <= variantWidth);
  return variant ? `/uploads/${match[1]}-${variant}.webp` : src;
}
