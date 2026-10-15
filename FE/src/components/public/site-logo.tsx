import Image from "next/image";
import type { PublicImage } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Logo dari pengaturan (tinggi tetap 32 px), atau nama situs kalau logo belum diisi.
// nameClassName: gaya teks nama (mis. satu baris + ellipsis di header).
export function SiteLogo({ logo, name, nameClassName }: { logo: PublicImage | null; name: string; nameClassName?: string }) {
  if (!logo) {
    return <span className={cn("text-body font-semibold tracking-[-0.02em] text-current", nameClassName)}>{name}</span>;
  }
  const width = logo.width ?? 160;
  const height = logo.height ?? 40;
  return (
    <Image
      src={logo.url}
      alt={logo.alt || name}
      width={width}
      height={height}
      sizes={`${Math.round((32 * width) / height)}px`}
      unoptimized={logo.mime === "image/svg+xml"}
      className="h-8 w-auto"
      // Logo header ada di layar pertama: dimuat langsung, tanpa prioritas tinggi (bukan LCP).
      loading="eager"
    />
  );
}
