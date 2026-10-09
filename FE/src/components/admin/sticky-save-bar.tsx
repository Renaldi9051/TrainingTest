"use client";

import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/admin/ui/button";
import { cn } from "@/lib/utils";

type StickySaveBarProps = {
  dirty: boolean;
  pending: boolean;
  // id form yang di-submit tombol Simpan (tombol bisa berada di luar elemen <form>).
  formId: string;
  saveLabel?: string;
  onReset?: () => void;
  // Aksi tambahan di kiri tombol Simpan, mis. "Pratinjau".
  extra?: ReactNode;
  className?: string;
};

// Bar simpan yang menempel di bawah layar (DESIGN 10). Status perubahan diumumkan ke pembaca layar.
export function StickySaveBar({
  dirty,
  pending,
  formId,
  saveLabel = "Simpan",
  onReset,
  extra,
  className,
}: StickySaveBarProps) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-4 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg px-4 py-3 sm:-mx-6 sm:px-6",
        className,
      )}
    >
      <p className="text-small text-fg-muted" role="status" aria-live="polite">
        {pending ? "Menyimpan..." : dirty ? "Ada perubahan yang belum disimpan." : "Semua perubahan tersimpan."}
      </p>
      <div className="flex items-center gap-2">
        {extra}
        {onReset ? (
          <Button type="button" variant="ghost" disabled={!dirty || pending} onClick={onReset}>
            Batalkan perubahan
          </Button>
        ) : null}
        <Button type="submit" form={formId} disabled={pending} aria-busy={pending}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
