"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, ExternalLinkIcon, Loader2Icon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/admin/ui/sheet";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Textarea } from "@/components/admin/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Media, MediaDetail, MediaInUseDetails, MediaUsage } from "@/lib/api/types";
import { MediaThumbnail } from "./media-thumbnail";
import {
  formatBytes,
  isImage,
  isMissingAlt,
  mediaKeys,
  mediaName,
  mediaTypeLabel,
} from "./media-utils";

type MediaDetailSheetProps = {
  mediaId: string | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function MediaDetailSheet({ mediaId, onClose, onDeleted }: MediaDetailSheetProps) {
  const detail = useQuery({
    queryKey: mediaKeys.detail(mediaId ?? ""),
    queryFn: async () => (await apiFetch<MediaDetail>(`/admin/media/${mediaId}`)).data,
    enabled: mediaId !== null,
  });

  return (
    <Sheet open={mediaId !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="truncate pr-6">
            {detail.data ? mediaName(detail.data) : "Detail media"}
          </SheetTitle>
          <SheetDescription>Pratinjau, informasi file, dan alt text.</SheetDescription>
        </SheetHeader>
        {detail.isPending ? (
          <div className="space-y-4 p-4" role="status" aria-label="Memuat detail">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : detail.isError ? (
          <div className="space-y-3 p-4">
            <p className="text-small text-status-error">
              {detail.error instanceof ApiError ? detail.error.message : "Detail tidak dapat dimuat."}
            </p>
            <Button variant="outline" size="sm" onClick={() => void detail.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <MediaDetailBody key={detail.data.id} media={detail.data} onDeleted={onDeleted} />
        )}
      </SheetContent>
    </Sheet>
  );
}

const formSchema = z.object({
  alt: z.string().trim().max(300, { error: "Alt text maksimal 300 karakter." }),
  folder: z
    .string()
    .trim()
    .max(60, { error: "Nama folder maksimal 60 karakter." })
    .regex(/^[\p{L}\p{N} _-]*$/u, {
      error: "Nama folder hanya boleh berisi huruf, angka, spasi, - dan _.",
    }),
});

type FormValues = z.infer<typeof formSchema>;

function MediaDetailBody({ media, onDeleted }: { media: MediaDetail; onDeleted: () => void }) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockingUsages, setBlockingUsages] = useState<MediaUsage[] | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { alt: media.alt ?? "", folder: media.folder ?? "" },
  });

  useEffect(() => {
    form.reset({ alt: media.alt ?? "", folder: media.folder ?? "" });
  }, [form, media.alt, media.folder]);

  const save = useMutation({
    mutationFn: async (values: FormValues) =>
      (
        await apiFetch<Media>(`/admin/media/${media.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alt: values.alt, folder: values.folder }),
        })
      ).data,
    onSuccess: async () => {
      toast.success("Perubahan disimpan.");
      await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          if (field === "alt" || field === "folder") form.setError(field, { message: messages[0] });
        }
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "Gagal menyimpan. Coba lagi.");
    },
  });

  const remove = useMutation({
    mutationFn: () => apiFetch(`/admin/media/${media.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setConfirmOpen(false);
      toast.success("Media dihapus.");
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "MEDIA_IN_USE") {
        setDeleteError(error.message);
        setBlockingUsages((error.details as MediaInUseDetails | undefined)?.usages ?? []);
        return;
      }
      setDeleteError(error instanceof ApiError ? error.message : "Gagal menghapus. Coba lagi.");
    },
  });

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(new URL(media.url, window.location.origin).toString());
      toast.success("URL disalin.");
    } catch {
      toast.error("URL tidak dapat disalin.");
    }
  }

  const missingAlt = isMissingAlt(media);

  return (
    <div className="flex flex-1 flex-col">
      <div className="space-y-6 p-4">
        <div className="relative aspect-video overflow-hidden rounded-md border border-border">
          <MediaThumbnail media={media} sizes="(min-width: 640px) 420px, 100vw" fit="contain" priority />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyUrl()}>
            <CopyIcon aria-hidden />
            Salin URL
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={media.url} target="_blank" rel="noreferrer">
              <ExternalLinkIcon aria-hidden />
              Buka file
            </a>
          </Button>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-small">
          <dt className="text-fg-muted">Tipe</dt>
          <dd className="text-fg">{mediaTypeLabel(media.mime)}</dd>
          <dt className="text-fg-muted">Ukuran</dt>
          <dd className="font-mono text-fg">{formatBytes(media.size)}</dd>
          {media.width && media.height ? (
            <>
              <dt className="text-fg-muted">Dimensi</dt>
              <dd className="font-mono text-fg">
                {media.width} × {media.height} px
              </dd>
            </>
          ) : null}
          {media.variants ? (
            <>
              <dt className="text-fg-muted">Varian</dt>
              <dd className="font-mono text-fg">
                {Object.values(media.variants)
                  .map((variant) => `${variant.width}w`)
                  .join(", ")}
              </dd>
            </>
          ) : null}
          <dt className="text-fg-muted">Diupload</dt>
          <dd className="text-fg">
            {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(
              new Date(media.createdAt),
            )}
          </dd>
          <dt className="text-fg-muted">Dipakai di</dt>
          <dd className="text-fg">
            {media.usages.length === 0 ? "Belum dipakai" : <UsageList usages={media.usages} />}
          </dd>
        </dl>

        <form
          id="media-detail-form"
          className="space-y-4 border-t border-border pt-6"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
          noValidate
        >
          {missingAlt ? (
            <p className="flex items-start gap-2 text-small text-status-warning" role="note">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              Gambar ini belum punya alt text. Alt text wajib untuk gambar yang tampil di publik.
            </p>
          ) : null}
          {isImage(media) ? (
            <FormField
              id="media-alt"
              label="Alt text"
              description="Jelaskan isi gambar secara singkat untuk pembaca layar dan SEO."
              error={form.formState.errors.alt?.message}
            >
              <Textarea rows={3} {...form.register("alt")} />
            </FormField>
          ) : null}
          <FormField
            id="media-folder-edit"
            label="Folder"
            description="Kosongkan kalau tanpa folder."
            error={form.formState.errors.folder?.message}
          >
            <Input {...form.register("folder")} />
          </FormField>
        </form>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-2 border-t border-border bg-bg p-4">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            setDeleteError(null);
            setBlockingUsages(null);
            setConfirmOpen(true);
          }}
        >
          <Trash2Icon aria-hidden />
          Hapus
        </Button>
        <Button
          type="submit"
          form="media-detail-form"
          size="sm"
          disabled={save.isPending || !form.formState.isDirty}
          aria-busy={save.isPending}
        >
          {save.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          Simpan
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Hapus media ini?"
        description="Media dipindahkan ke Sampah. Media yang masih dipakai konten tidak bisa dihapus."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      >
        {deleteError ? (
          <div className="space-y-2 rounded-md border border-border p-3" role="alert">
            <p className="text-small text-status-error">{deleteError}</p>
            {blockingUsages && blockingUsages.length > 0 ? <UsageList usages={blockingUsages} /> : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function UsageList({ usages }: { usages: MediaUsage[] }) {
  return (
    <ul className="space-y-1 text-small">
      {usages.map((usage) => (
        <li key={`${usage.entity}-${usage.id}-${usage.field}`}>
          <span className="text-fg-muted">{usage.entityLabel}:</span> {usage.label}{" "}
          <span className="text-fg-muted">
            ({usage.field}
            {usage.inTrash ? ", di Sampah" : ""})
          </span>
        </li>
      ))}
    </ul>
  );
}
