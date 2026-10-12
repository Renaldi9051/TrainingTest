import Image from "next/image";
import type { OptionItem } from "@/lib/api/types";

// Isi baris panel urutkan/picker: thumbnail kecil (kalau ada), label, keterangan.
// imageUrl sudah varian 320 dari BE, jadi tidak dioptimasi ulang.
export function OptionRow({ item }: { item: OptionItem }) {
  return (
    <>
      {item.imageUrl ? (
        <span className="relative size-8 shrink-0 overflow-hidden rounded-sm border border-border bg-bg-muted">
          <Image src={item.imageUrl} alt="" fill sizes="32px" unoptimized className="object-cover" />
        </span>
      ) : null}
      <span className="min-w-0 truncate font-medium text-fg-strong">{item.label}</span>
      {item.sublabel ? <span className="truncate font-mono text-xs text-fg-muted">{item.sublabel}</span> : null}
    </>
  );
}
