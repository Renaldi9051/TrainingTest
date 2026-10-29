import { MAGNETIC_MAX_PX } from "./tokens";

// Efek kursor (magnetic, label & gambar ikut kursor) hanya untuk perangkat dengan kursor presisi
// yang bisa hover, dan mati saat reduced motion (DESIGN.md 8.3).
export const CAN_HOVER_QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export type Box = { left: number; top: number; width: number; height: number };
export type Point = { x: number; y: number };

// Dua desimal, tanpa -0 (nilai CSS rapi dan mudah dites).
const round = (value: number) => Math.round(value * 100) / 100 || 0;
const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

// Geser magnetic: sebanding dengan jarak pointer dari pusat elemen (`box` = posisi tanpa geser),
// maksimal `max` px per sumbu (di tepi elemen).
export function magneticOffset(pointer: Point, box: Box, max = MAGNETIC_MAX_PX): Point {
  const axis = (position: number, start: number, size: number) => {
    const half = Math.max(size / 2, 1);
    return round(clamp(((position - (start + size / 2)) / half) * max, max));
  };
  return { x: axis(pointer.x, box.left, box.width), y: axis(pointer.y, box.top, box.height) };
}

export type IndicatorVariant = "pill" | "line";

// Kotak indikator aktif untuk elemen aktif (relatif ke kontainer): pill menutup elemen, line
// adalah garis setebal thickness px tepat di bawahnya (palet D: menu 2 px, tab 3 px).
export function indicatorBox(variant: IndicatorVariant, target: Box, thickness = 1): Box {
  if (variant === "pill") return target;
  return { left: target.left, top: target.top + target.height, width: target.width, height: thickness };
}

// FLIP: transform (transform-origin kiri atas) yang membuat indikator di posisi `to` tampak masih
// di posisi `from`, lalu dianimasikan ke `none`. null kalau posisinya sama (tidak perlu animasi).
export function flipTransform(from: Box, to: Box): string | null {
  const x = round(from.left - to.left);
  const y = round(from.top - to.top);
  const scaleX = to.width > 0 ? round(from.width / to.width) : 1;
  const scaleY = to.height > 0 ? round(from.height / to.height) : 1;
  if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5 && scaleX === 1 && scaleY === 1) return null;
  return `translate(${x}px, ${y}px) scale(${scaleX}, ${scaleY})`;
}
