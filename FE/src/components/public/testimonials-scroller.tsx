"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useId, useRef } from "react";
import { IndexNumber } from "@/components/decor/index-number";
import type { PublicTestimonial } from "@/lib/api/types";
import { PublicImage } from "./public-image";

// Testimoni dalam baris scroll-snap horizontal, tanpa autoplay (DESIGN 8.3). Bisa dipakai dengan
// keyboard: wilayah scroll bisa difokus (panah kiri/kanan menggulir) dan tombol Sebelumnya/
// Berikutnya menggulir satu kartu. Gulir halus dimatikan untuk prefers-reduced-motion.
// decor: nomor raksasa mono di atas tiap kutipan (DESIGN.md 13).
export function TestimonialsScroller({
  testimonials,
  label,
  decor = true,
}: {
  testimonials: PublicTestimonial[];
  label: string;
  decor?: boolean;
}) {
  const listId = useId();
  const scroller = useRef<HTMLUListElement>(null);

  function scrollByCard(direction: 1 | -1) {
    const list = scroller.current;
    const card = list?.querySelector("li");
    if (!list || !card) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    list.scrollBy({ left: direction * (card.getBoundingClientRect().width + 24), behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className="space-y-6">
      <ul
        id={listId}
        ref={scroller}
        tabIndex={0}
        aria-label={`${label}, gulir ke samping`}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4 [scrollbar-width:thin]"
      >
        {testimonials.map((testimonial, index) => (
          <li
            key={`${testimonial.name}-${index}`}
            className="w-[85%] shrink-0 snap-start border-t border-border pt-6 sm:w-[60%] lg:w-[calc((100%-48px)/3)]"
          >
            <figure className="flex h-full flex-col gap-6">
              {decor ? <IndexNumber position={index + 1} /> : null}
              <blockquote className="text-body-lg text-fg">
                <p>&ldquo;{testimonial.quote}&rdquo;</p>
              </blockquote>
              <figcaption className="mt-auto flex items-center gap-3">
                {testimonial.photo ? (
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-full bg-bg-muted">
                    <PublicImage image={{ ...testimonial.photo, alt: testimonial.photo.alt || testimonial.name }} sizes="40px" />
                  </span>
                ) : null}
                <span>
                  <span className="block text-small font-medium text-fg-strong">{testimonial.name}</span>
                  <span className="block text-small text-fg-muted">
                    {[testimonial.role, testimonial.company].filter(Boolean).join(", ")}
                  </span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {testimonials.length > 1 ? (
        <div className="flex gap-2">
          <button
            type="button"
            aria-controls={listId}
            onClick={() => scrollByCard(-1)}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border-strong text-fg outline-none transition-colors duration-150 hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <ChevronLeftIcon className="size-5" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">Testimoni sebelumnya</span>
          </button>
          <button
            type="button"
            aria-controls={listId}
            onClick={() => scrollByCard(1)}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border-strong text-fg outline-none transition-colors duration-150 hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <ChevronRightIcon className="size-5" strokeWidth={1.5} aria-hidden />
            <span className="sr-only">Testimoni berikutnya</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
