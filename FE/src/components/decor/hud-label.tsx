import { cn } from "@/lib/utils";

// Label HUD bergaya data kamera (DESIGN.md 6.1), mis. "LOKASI / SLEMAN", "SESI 04 / 12". Isinya
// harus data nyata dari CMS; kosong = tidak dirender (6.2). Dekoratif: info yang sama tersedia di
// konten utama, jadi disembunyikan dari pembaca layar.
export function HudLabel({
  children,
  decor = true,
  tone = "light",
  dot = false,
  className,
}: {
  children: string | null | undefined;
  decor?: boolean;
  tone?: "light" | "photo" | "inverse";
  // Titik status kecil di depan label (mis. status putar slideshow).
  dot?: boolean;
  className?: string;
}) {
  const text = children?.trim();
  if (!decor || !text) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none inline-flex items-center gap-2 font-mono text-label font-medium uppercase tracking-[0.08em]",
        tone === "light" ? "text-fg-muted" : "text-inverse-fg/85",
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {text}
    </span>
  );
}
