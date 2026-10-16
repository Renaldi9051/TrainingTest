import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClassName } from "./input";

// Select native (DESIGN.md 8.3): gaya sama dengan Input, panah lucide di kanan. Native supaya
// tetap jalan tanpa JavaScript (form filter GET) dan nyaman di mobile.
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <span className={cn("relative block", className)}>
      <select className={cn(fieldClassName, "h-10 appearance-none pr-9")} {...props}>
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        strokeWidth={1.5}
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted"
      />
    </span>
  );
}
