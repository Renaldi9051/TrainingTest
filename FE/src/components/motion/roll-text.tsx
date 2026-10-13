// Teks tombol CTA yang "roll" ke atas saat hover/fokus, diganti duplikatnya dari bawah
// (DESIGN.md 8.2). CSS murni (Server Component), hanya transform. Duplikat aria-hidden, jadi nama
// aksesibel tetap satu kali. Reduced motion & tanpa hover: teks diam (duplikat tersembunyi di mask).
// Dipakai di dalam elemen dengan kelas group/button (buttonVariants).
export function RollText({ children }: { children: string }) {
  const motionClass = "block transition-transform duration-300 ease-standard motion-reduce:transition-none";
  return (
    <span data-roll="" className="relative block overflow-hidden">
      <span
        className={`${motionClass} motion-safe:group-hover/button:-translate-y-full motion-safe:group-focus-visible/button:-translate-y-full`}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={`${motionClass} absolute inset-0 translate-y-full motion-safe:group-hover/button:translate-y-0 motion-safe:group-focus-visible/button:translate-y-0`}
      >
        {children}
      </span>
    </span>
  );
}
