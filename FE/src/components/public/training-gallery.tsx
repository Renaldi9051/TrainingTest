"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { PublicImage as PublicImageType } from "@/lib/api/types";
import { PublicImage } from "./public-image";

// Galeri foto pelatihan (hero geser) di halaman detail: scroll-snap + sentuh, dengan tombol panah
// dan titik indikator. Menggantikan blok cover tunggal supaya tidak ada gambar yang dobel.

export function TrainingGallery({ images, title }: { images: PublicImageType[]; title: string }) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);
  const labelId = useId();

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActive((prev) => (prev === index ? prev : index));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const el = scrollerRef.current;
      if (!el) return;
      const clamped = Math.max(0, Math.min(images.length - 1, index));
      el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    },
    [images.length],
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onScroll]);

  if (images.length === 0) return null;

  return (
    <section aria-labelledby={labelId} className="relative mb-6">
      <h2 id={labelId} className="sr-only">
        Galeri {title}
      </h2>
      <div className="group relative aspect-video overflow-hidden rounded-2xl bg-[#0b417f]">
        <ul
          ref={scrollerRef}
          className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, index) => (
            <li key={image.url} className="relative h-full w-full flex-none snap-center">
              <PublicImage
                image={image}
                sizes="(min-width: 1024px) 800px, 100vw"
                grayscale={false}
                priority={index === 0}
                fit="cover"
              />
            </li>
          ))}
        </ul>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              className="absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#0b417f] shadow-md transition hover:bg-white disabled:opacity-0 sm:flex"
            >
              <span aria-hidden className="text-xl leading-none">‹</span>
            </button>
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={() => goTo(active + 1)}
              disabled={active === images.length - 1}
              className="absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#0b417f] shadow-md transition hover:bg-white disabled:opacity-0 sm:flex"
            >
              <span aria-hidden className="text-xl leading-none">›</span>
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
              {images.map((image, index) => (
                <button
                  key={image.url}
                  type="button"
                  aria-label={`Ke foto ${index + 1}`}
                  aria-current={active === index}
                  onClick={() => goTo(index)}
                  className={`pointer-events-auto h-2 rounded-full shadow transition-all ${active === index ? "w-6 bg-white" : "w-2 bg-white/60 hover:bg-white/90"}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
