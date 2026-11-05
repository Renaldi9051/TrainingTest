"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";

// Kontainer scroll horizontal (mis. indeks huruf di mobile) yang menggeser isinya supaya elemen aktif
// ([aria-current]) terlihat di tengah, saat muat dan setiap activeKey berubah. Hanya scrollLeft milik
// kontainer ini (halaman tidak ikut bergulir); tanpa animasi, jadi aman untuk reduced motion.
// Di layar yang tidak meluap (scrollWidth = clientWidth) tidak berbuat apa-apa.
export function ScrollToActive({
  activeKey,
  label,
  className,
  children,
}: {
  activeKey: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || root.scrollWidth <= root.clientWidth) return;
    const active = root.querySelector<HTMLElement>("[aria-current]");
    if (!active) return;
    const rootBox = root.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    root.scrollLeft += box.left - rootBox.left - (root.clientWidth - box.width) / 2;
  }, [activeKey]);

  return (
    <nav ref={ref} aria-label={label} className={className}>
      {children}
    </nav>
  );
}
