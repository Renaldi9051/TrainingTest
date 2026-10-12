import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PREVIEW_EXIT } from "@/lib/session";

// Tampil di halaman publik saat draft mode aktif (pratinjau admin). Keluar = kembali ke path ini.
export function PreviewBanner({ path, note }: { path: string; note?: string }) {
  return (
    <div role="status" className="border-b border-fg-strong bg-bg-subtle">
      <Container className="flex flex-wrap items-center justify-between gap-3 py-3">
        <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-strong">
          Mode pratinjau · {note ?? "konten mungkin belum tayang"}
        </p>
        <form action={PREVIEW_EXIT} method="post">
          <input type="hidden" name="path" value={path} />
          <button type="submit" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            Keluar dari pratinjau
          </button>
        </form>
      </Container>
    </div>
  );
}
