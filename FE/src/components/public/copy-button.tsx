"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPIED_MS = 2000;

const noopSubscribe = () => () => {};

// Tombol salin teks (mis. nomor rekening). Baru tampil setelah JS siap, supaya tanpa JS tidak ada tombol
// mati (teksnya tetap bisa diseleksi manual). Clipboard tidak tersedia (mis. bukan HTTPS): teks target
// diseleksi supaya tinggal Ctrl+C. Status dibacakan pembaca layar lewat aria-live.
export function CopyButton({
  value,
  targetId,
  label,
  className,
}: {
  value: string;
  // Elemen berisi teks yang ditampilkan; diseleksi kalau clipboard gagal.
  targetId: string;
  // Nama yang disalin untuk pembaca layar, mis. "nomor rekening Bank Contoh".
  label: string;
  className?: string;
}) {
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [status, setStatus] = useState<"idle" | "copied" | "selected">("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!ready) return null;

  async function copy() {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      const target = document.getElementById(targetId);
      const selection = window.getSelection();
      if (target && selection) {
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setStatus("selected");
    }
    timer.current = window.setTimeout(() => setStatus("idle"), COPIED_MS);
  }

  const copied = status === "copied";
  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Salin ${label}`}
        className={cn(buttonVariants({ variant: "secondary", size: "sm" }), className)}
      >
        {copied ? <CheckIcon aria-hidden strokeWidth={1.5} /> : <CopyIcon aria-hidden strokeWidth={1.5} />}
        {copied ? "Tersalin" : "Salin"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} tersalin.` : status === "selected" ? `${label} terpilih, tekan Ctrl+C untuk menyalin.` : ""}
      </span>
    </>
  );
}
