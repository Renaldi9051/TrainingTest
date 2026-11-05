"use client";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicImage as PublicImageData } from "@/lib/api/types";
import { PublicImage } from "./public-image";
import { cn } from "@/lib/utils";

// Galeri dokumentasi kategori: mozaik 4 foto (foto 1 besar 2x2, 2 & 3 kecil, 4 lebar) di desktop,
// 1 kolom di mobile. Kurang dari 4 foto = grid sejajar biasa. Tiap foto tombol yang membuka lightbox
// (dialog modal native: Esc tutup, panah kiri/kanan ganti foto, fokus kembali ke tombol asal).
export function CategoryGallery({ images, categoryName }: { images: PublicImageData[]; categoryName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState(0);
  const total = images.length;
  const mosaic = total === 4;

  const open = useCallback((i: number, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setIndex(i);
    dialogRef.current?.showModal();
  }, []);

  const go = useCallback(
    (delta: number) => setIndex((current) => (current + delta + total) % total),
    [total],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onKey = (event: KeyboardEvent) => {
      if (!dialog.open) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    };
    dialog.addEventListener("keydown", onKey);
    return () => dialog.removeEventListener("keydown", onKey);
  }, [go]);

  // Kelas posisi mozaik per index (desktop). Mobile: semua 1 kolom.
  const cellClass = (i: number) => {
    if (!mosaic) return "";
    if (i === 0) return "sm:col-span-2 sm:row-span-2 sm:aspect-square";
    if (i === 3) return "sm:col-span-2";
    return "";
  };

  const current = images[index];

  return (
    <>
      <ul className={cn("grid gap-4", mosaic ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {images.map((image, i) => (
          <li key={image.url} className={cn("min-w-0", cellClass(i))}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={`Buka foto ${i + 1} dari ${total}`}
              onClick={(event) => open(i, event.currentTarget)}
              className="group/gal relative block aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-card bg-bg-muted outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:h-full"
            >
              <PublicImage
                image={image}
                film
                sizes="(min-width: 1024px) 600px, (min-width: 640px) 50vw, 100vw"
                className="transition-transform duration-300 ease-standard group-hover/gal:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/gal:scale-100"
              />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={`Galeri ${categoryName}`}
        onClose={() => openerRef.current?.focus()}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-inverse-bg/95 p-0 text-inverse-fg backdrop:bg-transparent"
      >
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-4 md:px-6">
            <p className="font-mono text-label uppercase tracking-[0.08em] text-inverse-muted">
              Foto {index + 1} / {total}
            </p>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-inverse-line px-4 text-small text-inverse-fg outline-none transition-colors duration-150 hover:bg-inverse-line/50 focus-visible:ring-2 focus-visible:ring-accent-on-dark"
            >
              Tutup
              <XIcon aria-hidden strokeWidth={1.5} className="size-4" />
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 md:px-16">
            {current ? (
              <div className="relative max-h-full w-full max-w-[56rem]">
                <div className="relative aspect-[4/3] w-full">
                  <PublicImage image={current} sizes="(min-width: 1024px) 896px, 100vw" className="object-contain" />
                </div>
                {current.alt ? (
                  <p className="mt-3 text-center text-small text-inverse-muted">{current.alt}</p>
                ) : null}
              </div>
            ) : null}

            {total > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Foto sebelumnya"
                  onClick={() => go(-1)}
                  className="absolute top-1/2 left-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-inverse-line text-inverse-fg outline-none transition-colors duration-150 hover:bg-inverse-line/50 focus-visible:ring-2 focus-visible:ring-accent-on-dark md:left-4"
                >
                  <ChevronLeftIcon aria-hidden strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  aria-label="Foto berikutnya"
                  onClick={() => go(1)}
                  className="absolute top-1/2 right-2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-inverse-line text-inverse-fg outline-none transition-colors duration-150 hover:bg-inverse-line/50 focus-visible:ring-2 focus-visible:ring-accent-on-dark md:right-4"
                >
                  <ChevronRightIcon aria-hidden strokeWidth={1.5} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </dialog>
    </>
  );
}
