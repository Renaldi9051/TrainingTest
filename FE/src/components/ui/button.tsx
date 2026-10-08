import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRightIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Tombol publik DESIGN.md 7. Animasi Motion (magnetic, roll text) menyusul di Fase 4.
export const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap",
    "transition-[background-color,color,border-color] duration-150 ease-standard",
    "outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "rounded-md bg-fg-strong text-inverse-fg hover:bg-fg-strong-hover",
        secondary:
          "rounded-md border border-border-strong bg-bg text-fg hover:bg-bg-subtle",
        // Garis tipis selalu ada; garis tegas memanjang dari kiri saat hover/fokus.
        ghost: [
          "rounded-none px-0 text-fg-strong",
          "before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border-strong",
          "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-fg-strong",
          "after:transition-transform after:duration-300 after:ease-standard",
          "hover:after:scale-x-100 focus-visible:after:scale-x-100",
        ],
      },
      size: {
        sm: "h-8 text-small [&_svg]:size-4",
        md: "h-10 text-small [&_svg]:size-4",
        lg: "h-12 text-body [&_svg]:size-5",
      },
    },
    compoundVariants: [
      { variant: ["primary", "secondary"], size: "sm", className: "px-3" },
      { variant: ["primary", "secondary"], size: "md", className: "px-4" },
      { variant: ["primary", "secondary"], size: "lg", className: "px-6" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export type ButtonProps = ComponentProps<"button"> &
  ButtonVariantProps & {
    // Ikon panah di kanan yang bergeser 4 px saat hover (untuk CTA).
    arrow?: boolean;
  };

export function ButtonArrow() {
  return (
    <ArrowRightIcon
      aria-hidden
      strokeWidth={1.5}
      className="transition-transform duration-150 ease-standard group-hover/button:translate-x-1"
    />
  );
}

export function ButtonContent({ children, arrow }: { children: ReactNode; arrow?: boolean }) {
  return (
    <>
      {children}
      {arrow ? <ButtonArrow /> : null}
    </>
  );
}

export function Button({
  className,
  variant,
  size,
  arrow,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      <ButtonContent arrow={arrow}>{children}</ButtonContent>
    </button>
  );
}
