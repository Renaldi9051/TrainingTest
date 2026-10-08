import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClassName } from "./input";

export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea rows={rows} className={cn(fieldClassName, "min-h-24 py-2", className)} {...props} />
  );
}
