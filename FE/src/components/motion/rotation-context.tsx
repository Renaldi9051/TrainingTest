"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Status jeda dibagi antara kata berganti (di dalam h1) dan tombol Jeda (di luar h1, supaya nama
// heading tetap utuh). Tanpa provider: kata berganti tanpa tombol.
type RotationControl = { paused: boolean; setPaused: (paused: boolean) => void };
export const RotationContext = createContext<RotationControl | null>(null);

export function RotationProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  return <RotationContext.Provider value={{ paused, setPaused }}>{children}</RotationContext.Provider>;
}

// Tanpa provider: tidak pernah dijeda lewat tombol.
export function useRotationPaused(): boolean {
  return useContext(RotationContext)?.paused ?? false;
}
