import { RevealImage } from "@/components/motion/reveal-parts";
import { PublicImage } from "@/components/public/public-image";
import type { PublicImage as PublicImageData } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { imageStackSlots, type ImageStackSlot } from "./decor-plan";

const SLOT_CLASS: Record<ImageStackSlot, string> = {
  single: "inset-0",
  back: "top-0 left-0 h-[62%] w-[70%]",
  front: "top-[30%] right-0 z-[2] h-[48%] w-[52%] border-8",
  low: "bottom-0 left-[12%] z-[1] h-[32%] w-[38%]",
};

const SLOT_SIZES: Record<ImageStackSlot, string> = {
  single: "(min-width: 768px) 50vw, 100vw",
  back: "(min-width: 768px) 35vw, 70vw",
  front: "(min-width: 768px) 26vw, 52vw",
  low: "(min-width: 768px) 19vw, 38vw",
};

// Kolase 1-3 gambar beda rasio saling tumpuk (DESIGN.md 6.1). Hanya gambar yang sudah terhubung ke
// entitasnya (tanpa placeholder); tanpa gambar = tidak dirender. Gambar adalah konten (alt dari
// CMS), bukan dekorasi. Grayscale, berwarna saat hover. `frameClassName`: warna bingkai gambar
// depan = latar section (mis. "border-bg-subtle"). Di dalam <Reveal>: tiap gambar wipe masuk.
export function ImageStack({
  images,
  frameClassName = "border-bg",
  className,
}: {
  images: PublicImageData[];
  frameClassName?: string;
  className?: string;
}) {
  const slots = imageStackSlots(images.length);
  if (slots.length === 0) return null;
  return (
    <div className={cn("relative h-[380px] md:h-[560px]", className)}>
      {slots.map((slot, index) => (
        <RevealImage
          key={slot}
          className={cn("group/stack absolute overflow-hidden bg-bg-muted", SLOT_CLASS[slot], slot === "front" && frameClassName)}
        >
          <PublicImage
            image={images[index]}
            sizes={SLOT_SIZES[slot]}
            className="transition-[filter] duration-300 ease-standard group-hover/stack:grayscale-0"
          />
        </RevealImage>
      ))}
    </div>
  );
}
