"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { parallaxOffset } from "./parallax-plan";

// Satu listener scroll untuk semua teks outline raksasa (elemen [data-parallax-x], DESIGN.md 9.2):
// geser horizontal pelan sesuai posisi section induknya, maks 80 px, hanya transform. Hanya elemen
// yang sedang terlihat yang dihitung (IntersectionObserver). Reduced motion: tidak bergerak. Dipasang
// sekali di layout publik; elemen tetap Server Component.
export function ParallaxEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax-x]"));
    if (elements.length === 0) return;
    const visible = new Set<HTMLElement>();
    let frame = 0;

    const paint = () => {
      frame = 0;
      const viewport = window.innerHeight;
      for (const element of visible) {
        const box = (element.parentElement ?? element).getBoundingClientRect();
        element.style.transform = `translate3d(${parallaxOffset(box.top, box.height, viewport)}px, 0, 0)`;
      }
    };
    const request = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLElement;
        if (entry.isIntersecting) visible.add(element);
        else visible.delete(element);
      }
      request();
    });
    elements.forEach((element) => observer.observe(element));
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    request();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, [pathname]);

  return null;
}
