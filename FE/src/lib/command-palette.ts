// Data & logika murni command palette (components/ui/command-palette.tsx), dipakai admin dan publik.

export type PaletteItem = {
  // Unik di seluruh palette (mis. "trainings:<id>").
  key: string;
  href: string;
  title: string;
  meta?: string | null;
  // Label kecil di kanan (mis. "DRAF").
  badge?: string | null;
};

export type PaletteGroup = { id: string; label: string; items: PaletteItem[] };

export type PaletteStatus = "idle" | "loading" | "error" | "ready";

export function flattenGroups(groups: readonly PaletteGroup[]): PaletteItem[] {
  return groups.flatMap((group) => group.items);
}

// Pindah pilihan dengan panah; berputar di ujung. -1 = belum ada pilihan.
export function moveActive(current: number, delta: number, count: number): number {
  if (count === 0) return -1;
  if (current < 0) return delta > 0 ? 0 : count - 1;
  return (current + delta + count) % count;
}

// Ctrl/Cmd+K tanpa Shift/Alt. Event yang sudah ditangani (mis. editor rich text memakai Ctrl/Cmd+K
// untuk sisipkan tautan) diabaikan.
export function isPaletteShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "defaultPrevented">): boolean {
  return (
    !event.defaultPrevented &&
    event.key.toLowerCase() === "k" &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey
  );
}
