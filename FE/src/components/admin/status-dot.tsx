import type { TrainingPublicState } from "@/lib/api/types";
import { PUBLIC_STATE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

// Status konten di admin: titik kecil berwarna status (DESIGN 2, pengecualian admin) + label teks.
export function PublicStateLabel({ state, className }: { state: TrainingPublicState; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs uppercase", className)}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          state === "PUBLISHED" && "bg-status-success",
          state === "SCHEDULED" && "bg-status-warning",
          state === "DRAFT" && "bg-fg-subtle",
        )}
      />
      {PUBLIC_STATE_LABELS[state]}
    </span>
  );
}
