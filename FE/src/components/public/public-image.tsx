import Image from "next/image";
import type { CSSProperties } from "react";
import type { PublicImage as PublicImageData } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type PublicImageProps = {
  image: PublicImageData;
  sizes: string;
  className?: string;
  // Grayscale hanya untuk logo klien dan opsi photoStyle "grayscale" di hero (DESIGN 2).
  grayscale?: boolean;
  // Palet D (DESIGN 2, v0.4): grading "film" (--photo-filter) untuk foto publik (hero, kartu, layanan,
  // portofolio, visi misi, detail, landing kategori). Bukan untuk logo. Diabaikan kalau grayscale.
  film?: boolean;
  // Gambar utama di layar pertama (LCP): dimuat langsung dengan prioritas tinggi.
  priority?: boolean;
  fit?: "cover" | "contain";
  // Mis. objectPosition dari titik fokus slide hero.
  style?: CSSProperties;
};

// Gambar dari media library dalam kotak berukuran tetap (parent menentukan rasio).
// Placeholder saat memuat: blok --bg-muted (bukan spinner).
export function PublicImage({ image, sizes, className, grayscale = false, film = false, priority, fit = "cover", style }: PublicImageProps) {
  return (
    <Image
      src={image.url}
      alt={image.alt ?? ""}
      fill
      sizes={sizes}
      // Next 16: prop `priority` usang dan tidak lagi memberi fetchpriority; pakai eager + high.
      loading={priority ? "eager" : undefined}
      fetchPriority={priority ? "high" : undefined}
      unoptimized={image.mime === "image/svg+xml"}
      style={style}
      className={cn(
        "bg-bg-muted",
        fit === "cover" ? "object-cover" : "object-contain",
        grayscale ? "grayscale" : film && "filter-(--photo-filter)",
        className,
      )}
    />
  );
}
