import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Kelas bersama Input & Textarea (DESIGN.md 8.3): border --border-strong, fokus border --primary + ring
// fokus 2 px offset 2 px (palet C; fallback netral di admin).
export const fieldClassName = cn(
  "w-full min-w-0 rounded-md border border-border-strong bg-bg px-3 text-body text-fg",
  "placeholder:text-fg-subtle transition-[border-color] duration-150 ease-standard",
  "outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
  "aria-invalid:border-fg-strong disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-fg-muted",
);

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return <input type={type} className={cn(fieldClassName, "h-10", className)} {...props} />;
}
