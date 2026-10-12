"use client";

import { Loader2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";

type FormDialogProps = {
  title: string;
  description?: string;
  // id <form> di dalam children; tombol Simpan di footer men-submit form ini.
  formId: string;
  dirty: boolean;
  pending: boolean;
  onClose: () => void;
  submitLabel?: string;
  className?: string;
  children: ReactNode;
};

// Dialog berisi form dengan unsaved-changes guard: menutup lewat Esc, klik di luar, tombol X,
// atau Batal saat ada perubahan meminta konfirmasi dulu. Navigasi/reload selama dialog terbuka
// juga dijaga (useUnsavedChangesGuard).
export function FormDialog({
  title,
  description,
  formId,
  dirty,
  pending,
  onClose,
  submitLabel = "Simpan",
  className,
  children,
}: FormDialogProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  useUnsavedChangesGuard(dirty);

  function requestClose() {
    if (pending) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => (!open ? requestClose() : undefined)}>
        <DialogContent className={cn("max-h-[90svh] overflow-y-auto", className)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={requestClose}>
              Batal
            </Button>
            <Button type="submit" form={formId} disabled={pending} aria-busy={pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Buang perubahan?"
        description="Perubahan di formulir ini belum disimpan dan akan hilang."
        confirmLabel="Buang perubahan"
        cancelLabel="Lanjut mengedit"
        destructive
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
