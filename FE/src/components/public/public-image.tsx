import Image from "next/image";
import type { PublicImage as PublicImageData } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type PublicImageProps = {
  image: PublicImageData;
  sizes: string;
  className?: string;
  // Gambar foto di publik grayscale (DESIGN 2); hover-to-color diatur kartu lewat group-hover.
  grayscale?: boolean;
  priority?: boolean;
  fit?: "cover" | "contain";
};

// Gambar dari media library dalam kotak berukuran tetap (parent menentukan rasio).
// Placeholder saat memuat: blok --bg-muted (bukan spinner).
export function PublicImage({ image, sizes, className, grayscale = true, priority, fit = "cover" }: PublicImageProps) {
  return (
    <Image
      src={image.url}
      alt={image.alt ?? ""}
      fill
      sizes={sizes}
      priority={priority}
      unoptimized={image.mime === "image/svg+xml"}
      className={cn(
        "bg-bg-muted",
        fit === "cover" ? "object-cover" : "object-contain",
        grayscale && "grayscale",
        className,
      )}
    />
  );
}
