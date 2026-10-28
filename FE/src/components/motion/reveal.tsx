"use client";

import { type ReactNode, useRef } from "react";
import { planReveal, type RevealKind } from "./reveal-plan";
import { playScramble } from "./scramble";
import { type RevealGroup, useReveal } from "./use-reveal";

type RevealTag = "div" | "ul" | "ol" | "li" | "dl" | "table" | "tbody";

type RevealProps = {
  as?: RevealTag;
  className?: string;
  // Semua anak langsung root ini dianimasikan dengan jenis yang sama (daftar, grid).
  "data-reveal-children"?: RevealKind;
  children: ReactNode;
};

function revealGroup(root: HTMLElement): RevealGroup {
  const { elements, scramble } = planReveal(root);
  if (scramble.length === 0) return { steps: elements };
  return {
    steps: elements,
    onPlay: () => {
      const cancels = scramble.map(playScramble);
      return () => cancels.forEach((cancel) => cancel());
    },
  };
}

// Root satu grup reveal saat scroll. Isinya dirender server (keadaan final); elemen bertanda
// data-reveal / data-reveal-children (RevealText, LineDraw, RevealImage, daftar & grid) dianimasikan
// bersama saat root masuk viewport. Lihat useReveal untuk aturan kapan grup disembunyikan.
export function Reveal({ as: Tag = "div", children, ...props }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  useReveal(ref, revealGroup);
  // Callback ref: satu fungsi yang cocok untuk semua tag di RevealTag.
  const setRef = (node: HTMLElement | null) => {
    ref.current = node;
  };
  return (
    <Tag {...props} ref={setRef} data-reveal-root="">
      {children}
    </Tag>
  );
}
