import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  // Ajakan tindakan, mis. tombol "Upload file".
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border-strong px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="size-6 text-fg-muted" strokeWidth={1.5} aria-hidden /> : null}
      <p className="text-body font-medium text-fg-strong">{title}</p>
      {description ? <p className="max-w-[48ch] text-small text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
