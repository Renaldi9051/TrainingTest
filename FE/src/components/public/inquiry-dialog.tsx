"use client";

import { XIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { RollText } from "@/components/motion/roll-text";
import { buttonVariants, MAGNETIC } from "@/components/ui/button";
import type { InquiryTraining } from "./inquiry-form";

// Form dimuat saat dialog dibuka pertama kali (tidak masuk JS awal halaman detail).
const InquiryForm = dynamic(() => import("./inquiry-form").then((module) => module.InquiryForm), {
  ssr: false,
  loading: () => (
    <p role="status" className="text-small text-fg-muted">
      Memuat form...
    </p>
  ),
});

// Tombol "Minta penawaran in-house" + dialog form inquiry (detail pelatihan). <dialog> native:
// Esc, backdrop, dan fokus terkurung ditangani browser; fokus kembali ke tombol saat ditutup.
export function InquiryDialog({
  label,
  training,
  siteName,
  privacyHref,
  variant = "secondary",
}: {
  label: string;
  training: InquiryTraining;
  siteName: string;
  privacyHref: string | null;
  variant?: "primary" | "secondary";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => triggerRef.current?.focus();
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        className={buttonVariants({ variant, size: "lg" })}
        {...MAGNETIC}
        onClick={() => {
          setOpened(true);
          ref.current?.showModal();
        }}
      >
        <RollText>{label}</RollText>
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[min(40rem,calc(100vw-2rem))] overflow-y-auto bg-bg p-0 text-fg backdrop:bg-fg-strong/60"
        onClick={(event) => {
          // Klik di backdrop (di luar isi dialog) menutup.
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className="space-y-6 p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-[24px] leading-[1.25] font-medium text-fg-strong">
              {label}
            </h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm text-fg-muted outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong"
              aria-label="Tutup"
            >
              <XIcon aria-hidden strokeWidth={1.5} />
            </button>
          </div>
          {opened ? <InquiryForm siteName={siteName} privacyHref={privacyHref} source="TRAINING_DETAIL" training={training} /> : null}
        </div>
      </dialog>
    </>
  );
}
