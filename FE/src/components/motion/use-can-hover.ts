"use client";

import { useSyncExternalStore } from "react";
import { CAN_HOVER_QUERY } from "./pointer";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(CAN_HOVER_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(CAN_HOVER_QUERY).matches;
// Server dan hidrasi: false, jadi efek kursor baru aktif setelah mount (tidak ada beda markup).
const getServerSnapshot = () => false;

// true kalau perangkat punya kursor presisi yang bisa hover dan reduced motion tidak aktif.
// Mengikuti perubahan (mis. mouse dicolok, setelan reduced motion diubah).
export function useCanHover(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
