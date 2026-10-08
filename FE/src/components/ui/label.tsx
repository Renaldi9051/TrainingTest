import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Label selalu di atas input (DESIGN.md 7), bukan placeholder sebagai label.
export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label className={cn("block text-small font-medium text-fg", className)} {...props} />
  );
}
