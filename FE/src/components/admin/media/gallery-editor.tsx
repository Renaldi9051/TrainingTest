"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, ImagePlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { mediaPreviewKey, MediaPickerDialog } from "@/components/admin/media/media-picker";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { isMissingAlt, mediaName } from "@/components/admin/media/media-utils";
import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { Media } from "@/lib/api/types";

type GalleryEditorProps = {
  value: string[];
  onChange: (ids: string[]) => void;
  // Media dari respons BE, supaya thumbnail tidak perlu fetch ulang.
  initialMedia?: Media[];
  // Error per index dari BE (imageIds.N) atau validasi form.
  itemErrors?: (string | undefined)[];
  max: number;
};

// Galeri berurutan: tambah dari media library, urutkan dengan drag & drop atau keyboard, lepas.
// Setiap gambar wajib punya alt (dicek BE saat simpan); yang belum diberi peringatan + link.
export function GalleryEditor({ value, onChange, initialMedia = [], itemErrors = [], max }: GalleryEditorProps) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const items = value.map((id) => ({ id }));
  const full = value.length >= max;

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center text-small text-fg-muted">
          Belum ada gambar di galeri.
        </p>
      ) : (
        <SortableList
          items={items}
          itemLabel={(item) => `gambar ${value.indexOf(item.id) + 1}`}
          onReorder={onChange}
          renderItem={(item, handle) => {
            const index = value.indexOf(item.id);
            return (
              <GalleryRow
                id={item.id}
                index={index}
                handle={handle}
                initial={initialMedia.find((media) => media.id === item.id)}
                error={itemErrors[index]}
                onRemove={() => onChange(value.filter((id) => id !== item.id))}
              />
            );
          }}
        />
      )}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => setPicking(true)}>
          <ImagePlusIcon aria-hidden />
          Tambah gambar
        </Button>
        <p className="text-small text-fg-muted">
          {value.length}/{max} gambar
        </p>
      </div>
      {picking ? (
        <MediaPickerDialog
          title="Tambah gambar ke galeri"
          currentId={null}
          onClose={() => setPicking(false)}
          onSelect={(media) => {
            setPicking(false);
            if (value.includes(media.id)) {
              toast.error("Gambar itu sudah ada di galeri.");
              return;
            }
            queryClient.setQueryData(mediaPreviewKey(media.id), media);
            onChange([...value, media.id]);
          }}
        />
      ) : null}
    </div>
  );
}

function GalleryRow({
  id,
  index,
  handle,
  initial,
  error,
  onRemove,
}: {
  id: string;
  index: number;
  handle: React.ReactNode;
  initial?: Media;
  error?: string;
  onRemove: () => void;
}) {
  // staleTime 0: kembali dari tab media library setelah mengisi alt = data alt terbaru.
  const query = useQuery({
    queryKey: mediaPreviewKey(id),
    queryFn: async () => (await apiFetch<Media>(`/admin/media/${id}`)).data,
    initialData: initial,
    staleTime: 0,
  });
  const media = query.data;
  const missingAlt = media ? isMissingAlt(media) : false;
  const errorId = error ? `gallery-${index}-error` : undefined;

  return (
    <div className="flex items-start gap-3 py-2" aria-describedby={errorId}>
      {handle}
      <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-md border border-border">
        {media ? (
          <MediaThumbnail media={media} sizes="80px" />
        ) : query.isError ? (
          <div className="flex h-full items-center justify-center bg-bg-subtle text-[10px] text-status-error">Hilang</div>
        ) : (
          <Skeleton className="absolute inset-0 rounded-none" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium text-fg-strong">
          <span className="mr-2 font-mono text-xs text-fg-muted">{String(index + 1).padStart(2, "0")}</span>
          {media ? mediaName(media) : query.isError ? "Gambar tidak ditemukan atau sudah dihapus" : "Memuat..."}
        </p>
        {media?.alt ? <p className="truncate text-small text-fg-muted">Alt: {media.alt}</p> : null}
        {missingAlt ? (
          <p className="flex flex-wrap items-center gap-x-2 text-small text-status-warning">
            <TriangleAlertIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
            Belum punya alt text, wajib sebelum disimpan.
            <Link
              href={`/admin/media?media=${id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-fg-strong underline underline-offset-4"
            >
              Isi alt di media library
              <ExternalLinkIcon className="size-3" aria-hidden />
              <span className="sr-only">(tab baru)</span>
            </Link>
          </p>
        ) : null}
        {error ? (
          <p id={errorId} role="alert" className="text-small text-status-error">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Lepas gambar ${index + 1}`} onClick={onRemove}>
        <XIcon strokeWidth={1.5} aria-hidden />
      </Button>
    </div>
  );
}
