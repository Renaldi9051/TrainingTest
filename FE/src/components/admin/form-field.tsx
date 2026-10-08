import { Slot } from "radix-ui";
import type { ReactNode } from "react";
import { Label } from "@/components/admin/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  className?: string;
  // Satu elemen input; id, aria-invalid, dan aria-describedby dipasang otomatis.
  children: ReactNode;
};

// Label di atas input (bukan placeholder sebagai label), deskripsi, dan pesan error.
export function FormField({
  id,
  label,
  error,
  description,
  required,
  className,
  children,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden className="text-fg-muted">
            *
          </span>
        ) : null}
      </Label>
      <Slot.Root id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy}>
        {children}
      </Slot.Root>
      {description ? (
        <p id={descriptionId} className="text-small text-fg-muted">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-small text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
