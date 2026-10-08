import type { ComponentProps, ElementType } from "react";
import { cn } from "@/lib/utils";

type ContainerProps = ComponentProps<"div"> & { as?: ElementType };

// Maks 1280 px, padding samping 16 px (mobile) / 24 px (DESIGN.md 4).
export function Container({ as: Component = "div", className, ...props }: ContainerProps) {
  return <Component className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-6", className)} {...props} />;
}
