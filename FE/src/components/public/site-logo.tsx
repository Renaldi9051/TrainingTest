import Image from "next/image";
import type { PublicImage } from "@/lib/api/types";

// Logo dari pengaturan (tinggi tetap 32 px), atau nama situs kalau logo belum diisi.
export function SiteLogo({ logo, name }: { logo: PublicImage | null; name: string }) {
  if (!logo) {
    return <span className="text-body font-semibold tracking-[-0.02em] text-current">{name}</span>;
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
      priority
    />
  );
}
