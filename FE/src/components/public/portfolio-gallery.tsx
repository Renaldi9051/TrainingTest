"use client";

import { XIcon } from "lucide-react";
import { useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { PublicImage as PublicImageData } from "@/lib/api/types";
import { Container } from "@/components/ui/container";
import { PublicImage } from "./public-image";

const GALLERY_SIZES = "(min-width: 1024px) 600px, calc(100vw - 32px)";
const noopSubscribe = () => () => {};

// Judul kartu portofolio sebagai tombol yang membuka galeri lengkap (semua foto + deskripsi).
// <dialog> modal native: fokus terkunci di dalam, Esc menutup, fokus kembali ke tombol. Seluruh kartu
// bisa diklik lewat pseudo-element tombol, tapi tetap satu tombol untuk pembaca layar. Tombol ada di
// dalam judul kartu, jadi dialognya dipasang ke <body> (portal) supaya tidak berada di dalam heading.
export function PortfolioGallery({
  title,
  meta,
  description,
  images,
}: {
  title: string;
  meta: string[];
  description: string | null;
  images: PublicImageData[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Portal hanya setelah hydrate (document belum ada saat render server).
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const dialog = (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="index-overlay fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-bg p-0 text-left text-fg backdrop:bg-transparent"
    >
      <Container className="pt-6 pb-16 md:pt-8">
        <div className="mb-8 flex items-start justify-between gap-4 md:mb-10">
          <div className="min-w-0">
            {meta.length > 0 ? (
              <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{meta.join(" / ")}</p>
            ) : null}
            <h2 id={titleId} className="mt-2 max-w-[30ch] text-h2 text-fg-strong">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-border-strong px-4 text-small text-fg outline-none transition-colors duration-150 ease-standard hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
          >
            Tutup
            <XIcon aria-hidden strokeWidth={1.5} className="size-4" />
          </button>
        </div>
        {description ? <p className="mb-10 max-w-[65ch] text-body-lg text-fg-muted">{description}</p> : null}
        {images.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {images.map((image) => (
              <li key={image.url} className="relative aspect-[4/3] overflow-hidden bg-bg-muted">
                <PublicImage image={image} sizes={GALLERY_SIZES} grayscale={false} />
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </dialog>
  );

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        className="cursor-pointer text-left underline-offset-4 outline-none after:absolute after:inset-0 group-hover:underline focus-visible:underline focus-visible:after:ring-2 focus-visible:after:ring-fg-strong focus-visible:after:ring-offset-4"
      >
        {title}
      </button>
      {mounted ? createPortal(dialog, document.body) : null}
    </>
  );
}
