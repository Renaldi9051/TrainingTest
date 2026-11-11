import Image from "next/image";
import { BrandMark } from "@/components/decor/brand-mark";
import type { PublicImage } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Merek situs: logo dari pengaturan (tinggi tetap 32 px) di samping nama situs. Selama logo belum
// diisi, tempatnya diisi tanda viewfinder (BrandMark). Nama selalu tampil, jadi logo dianggap ikon
// (alt kosong supaya nama tidak dibaca dua kali). nameClassName: gaya teks nama (mis. ellipsis di header).
export function SiteLogo({ logo, name, nameClassName }: { logo: PublicImage | null; name: string; nameClassName?: string }) {
  const width = logo?.width ?? 160;
  const height = logo?.height ?? 40;
  return (
    <>
      {logo ? (
        <Image
          src={logo.url}
          alt=""
          width={width}
          height={height}
          sizes={`${Math.round((32 * width) / height)}px`}
          unoptimized={logo.mime === "image/svg+xml"}
          className="h-8 w-auto shrink-0"
          // Logo header ada di layar pertama: dimuat langsung, tanpa prioritas tinggi (bukan LCP).
          loading="eager"
        />
      ) : (
        <BrandMark />
      )}
      <span className={cn("text-body font-semibold tracking-[-0.02em] text-current", nameClassName)}>{name}</span>
    </>
  );
}
