import Image from "next/image";
import type { CSSProperties } from "react";
import type { PublicImage as PublicImageData } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type PublicImageProps = {
  image: PublicImageData;
  sizes: string;
  className?: string;
  // Gambar foto di publik grayscale (DESIGN 2); hover-to-color diatur kartu lewat group-hover.
  grayscale?: boolean;
  // Gambar utama di layar pertama (LCP): dimuat langsung dengan prioritas tinggi.
  priority?: boolean;
  fit?: "cover" | "contain";
  // Mis. objectPosition dari titik fokus slide hero.
  style?: CSSProperties;
};

// Gambar dari media library dalam kotak berukuran tetap (parent menentukan rasio).
// Placeholder saat memuat: blok --bg-muted (bukan spinner).
export function PublicImage({ image, sizes, className, grayscale = true, priority, fit = "cover", style }: PublicImageProps) {
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
        grayscale && "grayscale",
        className,
      )}
    />
  );
}
