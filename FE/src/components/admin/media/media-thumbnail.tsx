import { FileTextIcon } from "lucide-react";
import Image from "next/image";
import type { Media } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type MediaThumbnailProps = {
  media: Media;
  sizes: string;
  className?: string;
  fit?: "cover" | "contain";
  priority?: boolean;
};

// Gambar raster memakai varian WebP dari BE lewat image loader; SVG tanpa loader (unoptimized).
export function MediaThumbnail({ media, sizes, className, fit = "cover", priority }: MediaThumbnailProps) {
  if (media.mime === "application/pdf") {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-bg-subtle", className)}>
        <FileTextIcon className="size-8 text-fg-muted" strokeWidth={1.5} aria-hidden />
        <span className="sr-only">Dokumen PDF</span>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full bg-bg-muted", className)}>
      <Image
        src={media.url}
        alt={media.alt ?? ""}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={media.mime === "image/svg+xml"}
        className={fit === "cover" ? "object-cover" : "object-contain"}
      />
    </div>
  );
}
