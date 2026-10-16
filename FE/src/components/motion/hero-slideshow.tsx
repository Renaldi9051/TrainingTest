"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import { GrainOverlay } from "@/components/decor/grain-overlay";
import { HudLabel } from "@/components/decor/hud-label";
import { RotatingBadge } from "@/components/decor/rotating-badge";
import { Viewfinder } from "@/components/decor/viewfinder";
import { PublicImage } from "@/components/public/public-image";
import { segmentKeyTarget } from "@/components/ui/segmented-plan";
import type { HeroLayout, HeroPhotoStyle, PublicHeroSlide } from "@/lib/api/types";
import { HEADER_OVER_ATTR, PAST_HERO_ATTR } from "@/lib/hero-marker";
import { cn } from "@/lib/utils";
import { HeroPauseButton } from "./hero-pause-button";
import { useHeroPaused } from "./hero-playback";
import { autoplayAllowed, nextSlide, segmentFill, slideCounter, slideStatus, type SlideBlockers } from "./hero-slides-plan";

// Gambar hero memenuhi lebar layar; > 1600 px memakai file WebP utama (image-loader).
const SLIDE_SIZES_FULL = "100vw";
const SLIDE_SIZES_SPLIT = "(min-width: 768px) 58vw, 100vw";

type Props = {
  slides: PublicHeroSlide[];
  intervalMs: number;
  layout: HeroLayout;
  photoStyle: HeroPhotoStyle;
  showViewfinder: boolean;
  decor: boolean;
  badge: { text: string; href: string } | null;
  // Ada kata berganti: tombol pause tetap perlu walau hanya 1 slide (WCAG 2.2.2).
  hasRotatingWords: boolean;
  // Teks hero (eyebrow, h1, subjudul, search, CTA), dirender server.
  children: ReactNode;
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Hero slideshow beranda (DESIGN.md 8.1): 1-6 slide dari CMS. 1 slide = foto statis tanpa indikator.
// 2+ slide: ganti otomatis tiap intervalMs (wipe clip-path 900 ms + Ken Burns), progres bersegmen yang
// bisa diklik, penghitung 01 / 04, caption, label HUD, tombol pause/play (juga menghentikan kata
// berganti). Berhenti saat kursor/fokus di hero, tab tidak aktif, atau hero di luar layar; panah
// kiri/kanan di indikator. Slide pertama = LCP (priority); slide lain dipasang setelah event load.
// Reduced motion: tanpa autoplay & Ken Burns, ganti slide langsung lewat indikator. fullbleed: foto
// penuh di belakang teks terang, header transparan di atasnya ([data-header-over]).
export function HeroSlideshow({ slides, intervalMs, layout, photoStyle, showViewfinder, decor, badge, hasRotatingWords, children }: Props) {
  const count = slides.length;
  const multiple = count > 1;
  const full = layout === "fullbleed";
  const sectionRef = useRef<HTMLElement>(null);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const segmentRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const elapsed = useRef(0);
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const userPaused = useHeroPaused();
  const [blockers, setBlockers] = useState<Omit<SlideBlockers, "userPaused">>({
    hover: false,
    focus: false,
    hidden: false,
    offscreen: false,
    reduced: false,
    pending: multiple,
  });
  const allBlockers: SlideBlockers = { ...blockers, userPaused };
  const playing = autoplayAllowed(count, allBlockers);
  const block = (change: Partial<typeof blockers>) => setBlockers((current) => ({ ...current, ...change }));

  // Kondisi awal di browser: reduced motion, tab, slide lain setelah halaman selesai dimuat.
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const block = (change: Partial<SlideBlockers>) => setBlockers((current) => ({ ...current, ...change }));
    block({ reduced: reducedMotion(), hidden: document.hidden });
    const onLoaded = () => block({ pending: false });
    if (document.readyState === "complete") onLoaded();
    else window.addEventListener("load", onLoaded, { once: true });
    const onVisibility = () => block({ hidden: document.hidden });
    const root = document.documentElement;
    const observer = new IntersectionObserver(([entry]) => {
      block({ offscreen: !entry.isIntersecting });
      // Hero sudah lewat ke atas layar: floating contact boleh muncul (public.css, DESIGN.md 8.11).
      if (full) root.toggleAttribute(PAST_HERO_ATTR, !entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(section);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("load", onLoaded);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeAttribute(PAST_HERO_ATTR);
    };
  }, [full]);

  function go(index: number) {
    if (index === active) return;
    elapsed.current = 0;
    block({ pending: false });
    setPrevious(active);
    setActive(index);
  }

  // Jam autoplay: rAF menambah waktu berjalan hanya saat diputar; bar progres diperbarui langsung di
  // DOM (scaleX), tanpa render ulang tiap frame.
  useEffect(() => {
    if (!multiple) return;
    let frame = 0;
    let last = performance.now();
    const paint = () => {
      fillRefs.current.forEach((element, index) => {
        if (element) element.style.transform = `scaleX(${segmentFill(index, active, elapsed.current, intervalMs, blockers.reduced)})`;
      });
    };
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      if (playing) {
        elapsed.current += delta;
        if (elapsed.current >= intervalMs) {
          elapsed.current = 0;
          setPrevious(active);
          setActive(nextSlide(active, count));
          return;
        }
      }
      paint();
      frame = requestAnimationFrame(tick);
    };
    paint();
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, playing, multiple, count, intervalMs, blockers.reduced]);

  function onIndicatorKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const target = segmentKeyTarget(active, event.key, count);
    if (target === null) return;
    event.preventDefault();
    go(target);
    segmentRefs.current[target]?.focus();
  }

  const current = slides[active];
  const status = slideStatus(count, allBlockers);
  const canPause = multiple || hasRotatingWords;
  const tone = full ? "text-inverse-fg" : "text-fg";
  const subtle = full ? "border-inverse-fg/40 hover:bg-inverse-fg/10" : "border-border-strong hover:bg-bg-subtle";

  const stage = (
    // Latar gelap selama foto dimuat (teks terang tetap terbaca). Bukan "section terbalik" (DESIGN.md 2:
    // hero bergambar tidak dihitung), jadi tidak memakai kelas bg-inverse-bg.
    <div className="absolute inset-0 overflow-hidden bg-fg-strong" aria-live={playing ? "off" : "polite"}>
      {slides.map((slide, index) => {
        // Sebelum event load hanya slide pertama yang dipasang (LCP); sisanya menyusul.
        if (index !== 0 && blockers.pending && index !== active) return null;
        const state = index === active ? "active" : index === previous ? "prev" : undefined;
        return (
          <div
            key={`${slide.image.url}-${index}`}
            className="hero-slide absolute inset-0 overflow-hidden"
            data-state={state}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${index + 1} dari ${count}`}
            aria-hidden={index === active ? undefined : true}
          >
            <PublicImage
              image={{ ...slide.image, alt: slide.alt }}
              sizes={full ? SLIDE_SIZES_FULL : SLIDE_SIZES_SPLIT}
              priority={index === 0}
              grayscale={photoStyle === "grayscale"}
              style={{ objectPosition: `${slide.focalX}% ${slide.focalY}%` }}
            />
          </div>
        );
      })}
      {full ? (
        <>
          {/* Lapisan gelap agar teks terang terbaca (palet C: gradasi --overlay-top .60 -> tipis di 35% ->
              --overlay-bottom .90; gradien gelap transparan hanya untuk overlay foto hero, DESIGN.md 5). */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[3] bg-linear-to-b from-overlay-top via-overlay-top/15 via-35% to-overlay-bottom"
          />
        </>
      ) : null}
      <GrainOverlay decor={decor} tone="photo" className="z-[3]" />
      <Viewfinder
        decor={decor && showViewfinder}
        crosshair
        className={cn("z-[4]", full ? "top-[104px] right-4 bottom-[112px] left-4 md:right-8 md:left-8" : "inset-5")}
        topLeft={<HudLabel tone="photo">{current?.hudLabel}</HudLabel>}
        topRight={
          multiple ? (
            <HudLabel tone="photo" dot>
              {status}
            </HudLabel>
          ) : null
        }
      />
    </div>
  );

  const indicator = canPause ? (
    <div className={cn("flex items-center gap-4 md:gap-6", full ? "h-[88px] border-t border-inverse-fg/15" : "mt-4 border-t border-border pt-4")}>
      {multiple ? (
        <>
          <p className="min-w-[72px] font-mono text-[13px] tracking-[0.08em] whitespace-nowrap tabular-nums">{slideCounter(active, count)}</p>
          {current?.caption ? (
            <p className="hidden min-w-0 shrink truncate font-mono text-label font-medium uppercase tracking-[0.08em] opacity-85 sm:block sm:max-w-[260px]">
              {current.href ? (
                <Link href={current.href} className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-current">
                  {current.caption}
                </Link>
              ) : (
                current.caption
              )}
            </p>
          ) : null}
          <div role="group" aria-label="Pilih slide" onKeyDown={onIndicatorKey} className="flex min-w-[120px] flex-1 gap-2">
            {slides.map((slide, index) => (
              <button
                key={`${slide.image.url}-${index}`}
                ref={(element) => {
                  segmentRefs.current[index] = element;
                }}
                type="button"
                onClick={() => go(index)}
                aria-label={`Tampilkan slide ${index + 1}${slide.caption ? `: ${slide.caption}` : ""}`}
                aria-current={index === active ? "true" : undefined}
                tabIndex={index === active ? 0 : -1}
                className="group/segment flex h-6 flex-1 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                <span className={cn("relative block h-[3px] w-full overflow-hidden rounded-full", full ? "bg-inverse-fg/30" : "bg-border-strong")}>
                  <span
                    ref={(element) => {
                      fillRefs.current[index] = element;
                    }}
                    data-segment-fill=""
                    className="absolute inset-0 origin-left bg-accent"
                    style={{ transform: `scaleX(${index < active ? 1 : 0})` }}
                  />
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <span className="flex-1" />
      )}
      <HeroPauseButton subject={multiple ? "slideshow" : "kata berganti"} className={subtle} />
    </div>
  ) : null;

  const handlers = {
    onMouseEnter: () => block({ hover: true }),
    onMouseLeave: () => block({ hover: false }),
    onFocus: () => block({ focus: true }),
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) block({ focus: false });
    },
  };
  const stageStyle = { "--hero-interval": `${intervalMs}ms` } as CSSProperties;
  const markers = {
    "data-slideshow": multiple ? "" : undefined,
    "data-paused": multiple && !playing ? "" : undefined,
  };

  if (full) {
    return (
      <section
        ref={sectionRef}
        {...{ [HEADER_OVER_ATTR]: "" }}
        {...markers}
        {...handlers}
        aria-roledescription={multiple ? "carousel" : undefined}
        aria-label="Sorotan"
        style={{ ...stageStyle, minHeight: "clamp(640px, 100svh, 900px)" }}
        className={cn("hero-stage relative isolate flex flex-col", tone)}
      >
        {stage}
        <div className="relative z-10 mt-auto pt-36 pb-10 md:pb-14">{children}</div>
        {decor && badge ? (
          // Mobile: kanan atas (area foto kosong di bawah label HUD), supaya tidak menimpa search/CTA.
          <RotatingBadge
            href={badge.href}
            text={badge.text}
            className="top-[148px] right-4 z-10 max-md:origin-top-right md:top-auto md:right-10 md:bottom-[136px]"
          />
        ) : null}
        {indicator ? <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 sm:px-6">{indicator}</div> : null}
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      {...markers}
      {...handlers}
      aria-roledescription={multiple ? "carousel" : undefined}
      aria-label="Sorotan"
      style={stageStyle}
      className={cn("hero-stage relative mx-auto grid w-full max-w-[1280px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-12 md:items-center md:gap-6 md:py-24", tone)}
    >
      <div className="md:col-span-5">{children}</div>
      <div className="md:col-span-7">
        <div className="relative aspect-[4/3]">
          {stage}
          {decor && badge ? (
            <RotatingBadge href={badge.href} text={badge.text} className="right-4 bottom-4 z-10" />
          ) : null}
        </div>
        {indicator}
      </div>
    </section>
  );
}
