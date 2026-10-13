"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { isClientLinkClick, pageEnterFrom, pageEnterStepMs, shouldAnimateEnter } from "./page-enter-plan";
import { PAGE_ENTER_MS } from "./tokens";
import { applyFrom, clear, play, type RevealStep } from "./use-reveal";

// Header halaman stagger masuk setelah navigasi klien yang dipicu klik link (mouse atau Enter) ke
// pathname baru. Dipasang sekali di layout publik; header ditandai data-page-enter di markup server
// (eyebrow, h1, intro). Muat penuh, reload, Back/Forward (tanpa klik), perubahan query saja (filter
// katalog), dan reduced motion: tidak beranimasi, konten tampil final dari server.
// h1 hero beranda tidak ditandai (punya animasi CSS sendiri).
export function PageEnter() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  const linkClick = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      const qualifies = isClientLinkClick(
        event,
        { href: link.href, target: link.target, hasDownload: link.hasAttribute("download") },
        window.location.origin,
      );
      if (qualifies) linkClick.current = performance.now();
    };
    // Back/Forward setelah klik yang tidak jadi berpindah halaman: lupakan kliknya.
    const onPop = () => {
      linkClick.current = null;
    };
    // Capture: dicatat sebelum handler Link Next memanggil preventDefault untuk navigasi klien.
    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // Layout effect: keadaan awal dipasang sebelum paint pertama halaman baru (tanpa kedip).
  useLayoutEffect(() => {
    const firstRender = previous.current === null;
    const pathnameChanged = previous.current !== pathname;
    previous.current = pathname;
    const sinceLinkClick = linkClick.current === null ? null : performance.now() - linkClick.current;
    if (pathnameChanged) linkClick.current = null;
    const animate = shouldAnimateEnter({
      firstRender,
      pathnameChanged,
      sinceLinkClick,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    if (!animate) return;

    // Halaman sebelumnya bisa tetap ada di DOM dalam keadaan tersembunyi, jadi hanya yang terlihat.
    const elements = Array.from(document.querySelectorAll<HTMLElement>("#konten [data-page-enter]")).filter(
      (element) => element.getClientRects().length > 0,
    );
    if (elements.length === 0) return;
    const step = pageEnterStepMs(elements.length) / 1000;
    const steps: RevealStep[] = elements.map((element, index) => ({
      element,
      from: pageEnterFrom(element.tagName),
      delay: index * step,
      duration: PAGE_ENTER_MS / 1000,
    }));
    steps.forEach(applyFrom);
    const animations = steps.map(play);
    return () => {
      // Pindah lagi sebelum selesai: hentikan dan kembalikan ke keadaan final.
      animations.forEach((animation) => animation.cancel());
      steps.forEach(clear);
    };
  }, [pathname]);

  return null;
}
