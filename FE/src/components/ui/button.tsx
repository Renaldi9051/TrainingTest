import { cva, type VariantProps } from "class-variance-authority";
import { ArrowRightIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { RollText } from "@/components/motion/roll-text";
import { cn } from "@/lib/utils";

// Tombol publik DESIGN.md 8.2 (palet C v0.3: primer --primary, CTA di hero/section gelap --accent
// dengan teks gelap). Juga dirender di admin (/admin/dev/ui, pencarian admin): kelas warnanya punya
// fallback netral di theme.css, jadi tampilan admin tidak berubah.
// Tombol publik DESIGN.md 7. Tombol CTA besar: tambahkan {...MAGNETIC} di elemennya dan `roll` di
// ButtonContent (DESIGN.md 8.2; efeknya dari PointerEffects dan RollText).
export const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap",
    // transform: geser magnetic (inline style dari PointerEffects) kembali halus saat kursor pergi.
    "transition-[background-color,color,border-color,transform] duration-150 ease-standard",
    "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "rounded-md bg-primary text-on-primary hover:bg-primary-hover",
        secondary:
          "rounded-md border border-border-strong bg-bg text-fg hover:border-line-hover hover:bg-bg-subtle hover:text-ink-hover",
        // Untuk section terbalik (latar --inverse-bg): CTA penutup.
        inverse: "rounded-md bg-cta text-on-cta hover:bg-cta-hover focus-visible:ring-focus-dark focus-visible:ring-offset-inverse-bg",
        inverseOutline:
          "rounded-md border border-inverse-fg/40 text-inverse-fg hover:border-inverse-fg hover:bg-inverse-fg/10 focus-visible:ring-focus-dark focus-visible:ring-offset-inverse-bg",
        // Garis tipis selalu ada; garis tegas memanjang dari kiri saat hover/fokus.
        ghost: [
          "rounded-none px-0 text-fg-strong",
          "before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-border-strong",
          "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-primary",
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
      { variant: ["primary", "secondary", "inverse", "inverseOutline"], size: "sm", className: "px-3" },
      { variant: ["primary", "secondary", "inverse", "inverseOutline"], size: "md", className: "px-4" },
      { variant: ["primary", "secondary", "inverse", "inverseOutline"], size: "lg", className: "px-6" },
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
      className="transition-transform duration-150 ease-standard motion-safe:group-hover/button:translate-x-1"
    />
  );
}

// Penanda tombol CTA besar yang ikut kursor (maks 6 px). Dibaca PointerEffects.
export const MAGNETIC = { "data-magnetic": "" } as const;

export function ButtonContent({ children, arrow, roll }: { children: ReactNode; arrow?: boolean; roll?: boolean }) {
  return (
    <>
      {roll && typeof children === "string" ? <RollText>{children}</RollText> : children}
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
