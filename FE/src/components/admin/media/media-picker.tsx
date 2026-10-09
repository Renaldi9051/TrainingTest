"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ImageIcon,
  ImagePlusIcon,
  Loader2Icon,
  SearchIcon,
  UploadIcon,
} from "lucide-react";
import { useDeferredValue, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/empty-state";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { isMissingAlt, mediaKeys, mediaName, MAX_UPLOAD_BYTES } from "@/components/admin/media/media-utils";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Media, MediaUploadResult, PaginationMeta } from "@/lib/api/types";
import { uploadWithProgress } from "@/lib/api/upload";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 18;
const ACCEPTED_IMAGES = ".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml";

type MediaPickerProps = {
  id?: string;
  value: string | null;
  onChange: (id: string | null) => void;
  // Data media untuk nilai awal (dari respons BE), supaya pratinjau tidak perlu fetch ulang.
  initialMedia?: Media | null;
  // Rasio kotak pratinjau; "contain" cocok untuk logo.
  aspect?: "4/3" | "16/9" | "1/1" | "3/1";
  fit?: "cover" | "contain";
  dialogTitle?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const ASPECT_CLASS = {
  "4/3": "aspect-[4/3]",
  "16/9": "aspect-video",
  "1/1": "aspect-square",
  "3/1": "aspect-[3/1]",
} as const;

export const mediaPreviewKey = (id: string) => ["admin", "media", "preview", id] as const;

// Pilih gambar dari media library atau upload langsung. Nilai yang disimpan hanya mediaId.
export function MediaPicker({
  id,
  value,
  onChange,
  initialMedia,
  aspect = "4/3",
  fit = "cover",
  dialogTitle = "Pilih gambar",
  ...aria
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const preview = useQuery({
    queryKey: mediaPreviewKey(value ?? ""),
    queryFn: async () => (await apiFetch<Media>(`/admin/media/${value}`)).data,
    enabled: Boolean(value),
    initialData: initialMedia && initialMedia.id === value ? initialMedia : undefined,
    staleTime: 5 * 60_000,
  });

  const media = value ? preview.data : null;

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative overflow-hidden rounded-md border border-border bg-bg-subtle",
          ASPECT_CLASS[aspect],
          aria["aria-invalid"] && "border-destructive",
        )}
      >
        {media ? (
          <MediaThumbnail media={media} sizes="320px" fit={fit} />
        ) : value && preview.isPending ? (
          <Skeleton className="absolute inset-0 rounded-none" />
        ) : value && preview.isError ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-small text-status-error">
            Gambar tidak ditemukan atau sudah dihapus.
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-muted">
            <ImageIcon className="size-6" strokeWidth={1.5} aria-hidden />
            <span className="text-small">Belum ada gambar</span>
          </div>
        )}
        {media && isMissingAlt(media) ? (
          <Badge
            variant="outline"
            className="absolute top-2 left-2 border-status-warning bg-bg font-mono text-[10px] uppercase text-status-warning"
          >
            Tanpa alt
          </Badge>
        ) : null}
      </div>
      {media ? <p className="truncate text-small text-fg-muted">{mediaName(media)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
        >
          <ImagePlusIcon aria-hidden />
          {value ? "Ganti gambar" : "Pilih gambar"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Lepas
          </Button>
        ) : null}
      </div>
      {open ? (
        <MediaPickerDialog
          title={dialogTitle}
          currentId={value}
          onClose={() => setOpen(false)}
          onSelect={(selected) => {
            queryClient.setQueryData(mediaPreviewKey(selected.id), selected);
            onChange(selected.id);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

type MediaPickerDialogProps = {
  title: string;
  currentId: string | null;
  onClose: () => void;
  onSelect: (media: Media) => void;
};

function MediaPickerDialog({ title, currentId, onClose, onSelect }: MediaPickerDialogProps) {
  const queryClient = useQueryClient();
  const searchId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Media | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const list = useQuery({
    queryKey: [...mediaKeys.all, "picker", { page, q }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), type: "image" });
      if (q) params.set("q", q);
      return apiFetch<Media[], PaginationMeta>(`/admin/media?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Ukuran file maksimal 10 MB.");
      return;
    }
    const body = new FormData();
    body.append("files", file);
    setUploadProgress(0);
    try {
      const result = await uploadWithProgress<MediaUploadResult>("/admin/media", body, setUploadProgress);
      const failure = result.data.failed[0];
      const created = result.data.created[0];
      if (failure || !created) {
        toast.error(failure?.message ?? "Upload gagal. Coba lagi.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
      toast.success("Gambar diupload. Jangan lupa isi alt text di media library.");
      onSelect(created);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Upload gagal. Coba lagi.");
    } finally {
      setUploadProgress(null);
    }
  }

  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const uploading = uploadProgress !== null;

  return (
    <Dialog open onOpenChange={(next) => (!next && !uploading ? onClose() : undefined)}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Pilih dari media library atau upload gambar baru (maks. 10 MB).</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor={searchId} className="sr-only">
              Cari gambar
            </label>
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            <Input
              id={searchId}
              type="search"
              className="pl-9"
              placeholder="Cari nama file atau alt text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGES}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
          <Button type="button" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2Icon className="animate-spin" aria-hidden /> : <UploadIcon aria-hidden />}
            {uploading ? `Mengupload ${Math.round((uploadProgress ?? 0) * 100)}%` : "Upload gambar"}
          </Button>
        </div>

        {list.isPending ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6" role="status" aria-label="Memuat gambar">
            {Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="aspect-square" />
            ))}
          </div>
        ) : list.isError ? (
          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
            <p className="text-small text-status-error">Gambar tidak dapat dimuat.</p>
            <Button variant="outline" size="sm" onClick={() => void list.refetch()}>
              Coba lagi
            </Button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={q ? "Tidak ada gambar yang cocok" : "Belum ada gambar"}
            description={q ? "Ubah kata kunci pencarian." : "Upload gambar pertama lewat tombol di atas."}
          />
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6" aria-busy={list.isFetching}>
            {items.map((item) => {
              const active = (selected?.id ?? currentId) === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-label={`Pilih ${mediaName(item)}`}
                    onClick={() => setSelected(item)}
                    onDoubleClick={() => onSelect(item)}
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      active ? "border-fg-strong ring-1 ring-fg-strong" : "border-border",
                    )}
                  >
                    <MediaThumbnail media={item} sizes="120px" />
                    {isMissingAlt(item) ? (
                      <span className="absolute right-1 bottom-1 rounded-sm bg-bg px-1 font-mono text-[10px] uppercase text-status-warning">
                        Tanpa alt
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-between">
            <p className="text-small text-fg-muted">
              Halaman {meta.page} dari {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Halaman sebelumnya"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeftIcon aria-hidden />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Halaman berikutnya"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                <ChevronRightIcon aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={uploading} onClick={onClose}>
            Batal
          </Button>
          <Button type="button" disabled={!selected || uploading} onClick={() => selected && onSelect(selected)}>
            Pakai gambar ini
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
