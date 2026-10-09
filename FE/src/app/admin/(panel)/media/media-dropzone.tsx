"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, UploadIcon, XIcon } from "lucide-react";
import { useId, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui/button";
import { ApiError } from "@/lib/api/client";
import type { MediaUploadResult } from "@/lib/api/types";
import { uploadWithProgress } from "@/lib/api/upload";
import { cn } from "@/lib/utils";
import { ACCEPTED_FILES, formatBytes, MAX_UPLOAD_BYTES, mediaKeys } from "@/components/admin/media/media-utils";

type UploadStatus = "queued" | "uploading" | "done" | "error";

type UploadItem = {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  message?: string;
};

export function MediaDropzone({ folder }: { folder: string | null }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);

  function patchItem(key: string, patch: Partial<UploadItem>) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    const queued = files.map((file) => {
      const tooLarge = file.size > MAX_UPLOAD_BYTES;
      return {
        file,
        item: {
          key: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          progress: 0,
          status: tooLarge ? "error" : "queued",
          message: tooLarge ? "Ukuran file maksimal 10 MB." : undefined,
        } satisfies UploadItem,
      };
    });
    setItems((current) => [...queued.map(({ item }) => item), ...current]);

    let succeeded = 0;
    let failed = queued.filter(({ item }) => item.status === "error").length;

    // Satu file per request: progress & error per file, dan body tidak melewati batas 10 MB.
    for (const { file, item } of queued) {
      if (item.status === "error") continue;
      patchItem(item.key, { status: "uploading" });
      const body = new FormData();
      body.append("files", file);
      if (folder) body.append("folder", folder);
      try {
        const result = await uploadWithProgress<MediaUploadResult>("/admin/media", body, (fraction) =>
          patchItem(item.key, { progress: fraction }),
        );
        const failure = result.data.failed[0];
        if (failure) {
          failed += 1;
          patchItem(item.key, { status: "error", message: failure.message });
        } else {
          succeeded += 1;
          patchItem(item.key, { status: "done", progress: 1 });
        }
      } catch (error) {
        failed += 1;
        patchItem(item.key, {
          status: "error",
          message: error instanceof ApiError ? error.message : "Upload gagal. Coba lagi.",
        });
      }
    }

    if (succeeded > 0) {
      await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
      toast.success(`${succeeded} file berhasil diupload.`);
    }
    if (failed > 0) toast.error(`${failed} file gagal diupload.`);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        data-testid="media-dropzone"
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-md border border-dashed px-6 py-8 text-center transition-colors duration-150",
          dragging ? "border-fg-strong bg-bg-subtle" : "border-border-strong",
        )}
      >
        <UploadIcon className="size-6 text-fg-muted" strokeWidth={1.5} aria-hidden />
        <p className="text-small text-fg">
          Tarik file ke sini atau{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-small underline underline-offset-4"
            onClick={() => inputRef.current?.click()}
            aria-describedby={hintId}
          >
            pilih file
          </Button>
        </p>
        <p id={hintId} className="text-xs text-fg-muted">
          JPG, PNG, WebP, SVG, atau PDF. Maksimal 10 MB per file.
          {folder ? ` Masuk ke folder "${folder}".` : null}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          className="sr-only"
          tabIndex={-1}
          aria-label="Pilih file untuk diupload"
          data-testid="media-file-input"
          onChange={(event) => {
            void uploadFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>

      {items.length > 0 ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-mono text-label font-medium uppercase text-fg-muted">Upload</p>
            {items.every((item) => item.status === "done" || item.status === "error") ? (
              <Button variant="ghost" size="xs" onClick={() => setItems([])}>
                Bersihkan
              </Button>
            ) : null}
          </div>
          <ul className="divide-y divide-border border-y border-border" aria-live="polite">
            {items.map((item) => (
              <UploadRow key={item.key} item={item} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function UploadRow({ item }: { item: UploadItem }) {
  const percent = Math.round(item.progress * 100);
  return (
    <li className="flex items-center gap-3 py-2 text-small">
      <span className="w-5 shrink-0" aria-hidden>
        {item.status === "done" ? <CheckIcon className="size-4 text-status-success" /> : null}
        {item.status === "error" ? <XIcon className="size-4 text-status-error" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-fg">{item.name}</span>
          <span className="shrink-0 font-mono text-xs text-fg-muted">
            {item.status === "uploading" ? `${percent}%` : formatBytes(item.size)}
          </span>
        </div>
        {item.status === "uploading" || item.status === "queued" ? (
          <div
            className="mt-1.5 h-0.5 w-full overflow-hidden bg-bg-muted"
            role="progressbar"
            aria-label={`Progres upload ${item.name}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full origin-left bg-fg-strong transition-transform duration-150"
              style={{ transform: `scaleX(${item.progress})` }}
            />
          </div>
        ) : null}
        {item.status === "error" && item.message ? (
          <p className="mt-0.5 text-xs text-status-error">{item.message}</p>
        ) : null}
      </div>
    </li>
  );
}
