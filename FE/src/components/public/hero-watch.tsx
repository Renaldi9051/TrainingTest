"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { HEADER_OVER_ATTR, PAST_HERO_ATTR } from "@/lib/hero-marker";

// Menandai html[data-past-hero] setelah hero (elemen [data-header-over]) lewat ke atas layar, supaya
// floating contact baru muncul saat itu (DESIGN.md 8.11). Halaman tanpa hero: atribut dibersihkan
// (CSS hanya menyembunyikan tombol kalau hero ada). Dipasang sekali di layout publik.
export function HeroWatch() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const hero = document.querySelector(`[${HEADER_OVER_ATTR}]`);
    if (!hero) {
      root.removeAttribute(PAST_HERO_ATTR);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      // Lewat = sudah tidak terlihat dan berada di atas viewport (bukan di bawahnya).
      const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      root.toggleAttribute(PAST_HERO_ATTR, past);
    });
    observer.observe(hero);
    return () => {
      observer.disconnect();
      root.removeAttribute(PAST_HERO_ATTR);
    };
  }, [pathname]);

  return null;
}
