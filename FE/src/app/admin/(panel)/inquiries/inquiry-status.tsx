import type { InquiryStatus } from "@/lib/api/types";
import { INQUIRY_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const inquiryKeys = {
  all: ["admin", "inquiries"] as const,
  detail: (id: string) => ["admin", "inquiries", "detail", id] as const,
  count: ["admin", "inquiries", "count"] as const,
};

// Status inquiry: titik kecil berwarna status (DESIGN 2, pengecualian admin) + label teks.
export function InquiryStatusLabel({ status, className }: { status: InquiryStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs uppercase", className)}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "NEW" && "bg-status-warning",
          status === "IN_PROGRESS" && "bg-fg-strong",
          status === "DONE" && "bg-status-success",
        )}
      />
      {INQUIRY_STATUS_LABELS[status]}
    </span>
  );
}
