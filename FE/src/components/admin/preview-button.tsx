"use client";

import { EyeIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/admin/ui/button";

// Pratinjau (draft mode) memakai versi tersimpan, jadi dinonaktifkan selama form punya
// perubahan yang belum disimpan.
export function PreviewButton({ href, disabled }: { href: string; disabled: boolean }) {
  const helpId = useId();
  if (disabled) {
    return (
      <Button type="button" variant="outline" disabled aria-describedby={helpId}>
        <EyeIcon aria-hidden />
        Pratinjau
        <span id={helpId} className="sr-only">
          Simpan dulu untuk melihat pratinjau.
        </span>
      </Button>
    );
  }
  return (
    <Button variant="outline" asChild>
      <a href={href} target="_blank" rel="noreferrer">
        <EyeIcon aria-hidden />
        Pratinjau
        <span className="sr-only">(tab baru)</span>
      </a>
    </Button>
  );
}
