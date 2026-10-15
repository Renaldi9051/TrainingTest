import { cn } from "@/lib/utils";

// Teks outline raksasa di belakang konten (DESIGN.md 6.1): token mega (96/200 px, jadi mobile
// otomatis ~50%), stroke 1 px, isi transparan, boleh terpotong tepi layar. Isi dari CMS (judul
// section/kategori); kosong = tidak dirender. Posisi lewat className; induk relative +
// overflow-hidden kalau tidak boleh menembus section.
export function OutlineText({
  children,
  decor = true,
  tone = "light",
  className,
}: {
  children: string | null | undefined;
  decor?: boolean;
  tone?: "light" | "inverse";
  className?: string;
}) {
  const text = children?.trim();
  if (!decor || !text) return null;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-0 text-mega whitespace-nowrap text-transparent select-none",
        tone === "inverse" ? "[-webkit-text-stroke:1px_var(--inverse-line)]" : "[-webkit-text-stroke:1px_var(--border-strong)]",
        className,
      )}
    >
      {text}
    </div>
  );
}
