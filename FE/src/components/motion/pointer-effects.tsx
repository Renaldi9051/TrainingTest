"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { magneticOffset, type Point } from "./pointer";
import { CURSOR_OFFSET_PX } from "./tokens";
import { useCanHover } from "./use-can-hover";

const DEFAULT_LABEL = "Lihat →";

// Efek kursor untuk seluruh halaman publik lewat satu listener (event delegation), jadi tombol,
// kartu, dan baris tetap Server Component. Elemen ditandai atribut:
// - data-magnetic: ikut kursor maksimal 6 px (tombol CTA besar).
// - data-cursor-label="teks": label kecil ikut kursor (default "Lihat →"), kursor sistem tetap tampil.
// - data-cursor-image: gambar di dalamnya ([data-cursor-follow]) ikut kursor di dalam baris.
// Hanya transform & opacity. Mati di perangkat tanpa hover/kursor presisi dan saat reduced motion
// (useCanHover); semua konten tetap bisa diakses dengan keyboard tanpa efek ini.
export function PointerEffects() {
  const canHover = useCanHover();
  const pathname = usePathname();
  const labelRef = useRef<HTMLDivElement>(null);
  const labelTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const label = labelRef.current;
    const labelText = labelTextRef.current;
    if (!canHover || !label || !labelText) return;

    let pointer: Point | null = null;
    let frame = 0;
    let magnetic: { element: HTMLElement; offset: Point } | null = null;
    let follow: { row: HTMLElement; element: HTMLElement } | null = null;

    const resetMagnetic = () => {
      magnetic?.element.style.removeProperty("transform");
      magnetic = null;
    };
    const hideFollow = () => {
      follow?.element.removeAttribute("data-active");
      follow = null;
    };
    const hideLabel = () => label.removeAttribute("data-active");

    const updateMagnetic = (target: Element | null, at: Point) => {
      const element = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
      if (element !== magnetic?.element) resetMagnetic();
      if (!element) return;
      const current = magnetic?.offset ?? { x: 0, y: 0 };
      const rect = element.getBoundingClientRect();
      // Posisi tanpa geser: rect dikurangi geser yang sedang berlaku.
      const offset = magneticOffset(at, { left: rect.left - current.x, top: rect.top - current.y, width: rect.width, height: rect.height });
      element.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
      magnetic = { element, offset };
    };

    const updateLabel = (target: Element | null, at: Point) => {
      const card = target?.closest<HTMLElement>("[data-cursor-label]") ?? null;
      if (!card) return hideLabel();
      const text = card.dataset.cursorLabel || DEFAULT_LABEL;
      if (labelText.textContent !== text) labelText.textContent = text;
      label.style.transform = `translate3d(${at.x + CURSOR_OFFSET_PX}px, ${at.y + CURSOR_OFFSET_PX}px, 0)`;
      label.setAttribute("data-active", "");
    };

    const updateFollow = (target: Element | null, at: Point) => {
      const row = target?.closest<HTMLElement>("[data-cursor-image]") ?? null;
      if (row !== follow?.row) hideFollow();
      const element = row?.querySelector<HTMLElement>("[data-cursor-follow]");
      if (!row || !element) return;
      const rect = row.getBoundingClientRect();
      const transform = `translate3d(${at.x - rect.left + CURSOR_OFFSET_PX}px, ${at.y - rect.top - element.offsetHeight / 2}px, 0)`;
      if (follow) {
        element.style.transform = transform;
        return;
      }
      // Baris baru: langsung di posisi kursor (tanpa meluncur dari posisi lama), lalu muncul.
      element.style.transition = "none";
      element.style.transform = transform;
      void element.offsetWidth;
      element.style.removeProperty("transition");
      element.setAttribute("data-active", "");
      follow = { row, element };
    };

    const update = () => {
      frame = 0;
      const at = pointer;
      const target = at ? document.elementFromPoint(at.x, at.y) : null;
      if (!at || !target) {
        resetMagnetic();
        hideFollow();
        hideLabel();
        return;
      }
      updateMagnetic(target, at);
      updateLabel(target, at);
      updateFollow(target, at);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      schedule();
    };
    // Scroll tanpa menggerakkan mouse: elemen di bawah kursor berubah.
    const onScroll = () => {
      if (pointer) schedule();
    };
    const onOut = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      pointer = null;
      schedule();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("scroll", onScroll, { capture: true });
      resetMagnetic();
      hideFollow();
      hideLabel();
    };
    // pathname: setelah pindah halaman semua efek direset sampai kursor bergerak lagi.
  }, [canHover, pathname]);

  if (!canHover) return null;
  return (
    <div ref={labelRef} aria-hidden data-cursor-label-float="" className="group/cursor pointer-events-none fixed top-0 left-0 z-50">
      <span
        ref={labelTextRef}
        className="block scale-90 rounded-full bg-fg-strong px-3 py-1.5 font-mono text-label whitespace-nowrap text-inverse-fg uppercase tracking-[0.08em] opacity-0 transition-[opacity,scale] duration-150 ease-standard group-data-active/cursor:scale-100 group-data-active/cursor:opacity-100"
      />
    </div>
  );
}
