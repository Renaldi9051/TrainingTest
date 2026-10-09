"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, ImagesIcon, SearchIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { Badge } from "@/components/admin/ui/badge";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { Media, PaginationMeta } from "@/lib/api/types";
import { MediaDetailSheet } from "./media-detail";
import { MediaDropzone } from "./media-dropzone";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { formatBytes, isMissingAlt, mediaKeys, mediaName } from "@/components/admin/media/media-utils";

const PAGE_SIZE = 24;
const ALL_FOLDERS = "__all";

export function MediaLibrary() {
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [folder, setFolder] = useState(ALL_FOLDERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activeFolder = folder === ALL_FOLDERS ? "" : folder;

  const list = useQuery({
    queryKey: mediaKeys.list({ page, q, folder: activeFolder }),
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (activeFolder) params.set("folder", activeFolder);
      return apiFetch<Media[], PaginationMeta>(`/admin/media?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const folders = useQuery({
    queryKey: mediaKeys.folders,
    queryFn: async () => (await apiFetch<string[]>("/admin/media/folders")).data,
  });

  const items = list.data?.data ?? [];
  const meta = list.data?.meta;
  const filtered = Boolean(q || activeFolder);

  return (
    <div className="space-y-6">
      <MediaDropzone folder={activeFolder || null} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="media-search">Cari</Label>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
              strokeWidth={1.5}
              aria-hidden
            />
            <Input
              id="media-search"
              type="search"
              className="pl-9"
              placeholder="Nama file atau alt text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="space-y-2 sm:w-56">
          <Label htmlFor="media-folder">Folder</Label>
          <Select
            value={folder}
            onValueChange={(value) => {
              setFolder(value);
              setPage(1);
            }}
          >
            <SelectTrigger id="media-folder" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FOLDERS}>Semua folder</SelectItem>
              {(folders.data ?? []).map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.isPending ? (
        <GridSkeleton />
      ) : list.isError ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
          <p className="text-small text-status-error">Media tidak dapat dimuat.</p>
          <Button variant="outline" size="sm" onClick={() => void list.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImagesIcon}
          title={filtered ? "Tidak ada media yang cocok" : "Belum ada media"}
          description={
            filtered
              ? "Ubah kata kunci atau pilih folder lain."
              : "Upload gambar atau PDF lewat area di atas untuk mulai mengisi media library."
          }
        />
      ) : (
        <ul
          className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
          aria-busy={list.isFetching}
          data-testid="media-grid"
        >
          {items.map((media) => (
            <li key={media.id}>
              <button
                type="button"
                onClick={() => setSelectedId(media.id)}
                className="group w-full rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2"
                aria-label={`Lihat detail ${mediaName(media)}`}
              >
                <div className="relative aspect-square overflow-hidden rounded-md border border-border">
                  <MediaThumbnail
                    media={media}
                    sizes="(min-width: 1280px) 180px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="transition-transform duration-300 ease-standard group-hover:scale-[1.03]"
                  />
                  {isMissingAlt(media) ? (
                    <Badge
                      variant="outline"
                      className="absolute top-2 left-2 border-status-warning bg-bg font-mono text-[10px] uppercase text-status-warning"
                    >
                      Tanpa alt
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 truncate text-small text-fg">{mediaName(media)}</p>
                <p className="font-mono text-xs text-fg-muted">
                  {formatBytes(media.size)}
                  {media.width && media.height ? ` · ${media.width}×${media.height}` : null}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 ? (
        <nav className="flex items-center justify-between border-t border-border pt-4" aria-label="Paginasi">
          <p className="text-small text-fg-muted">
            Halaman {meta.page} dari {meta.totalPages} · {meta.total} file
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeftIcon aria-hidden />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Berikutnya
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </nav>
      ) : null}

      <MediaDetailSheet
        mediaId={selectedId}
        onClose={() => setSelectedId(null)}
        onDeleted={() => {
          setSelectedId(null);
          if (items.length === 1 && page > 1) setPage((current) => current - 1);
        }}
      />
    </div>
  );
}

function GridSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
      role="status"
      aria-label="Memuat media"
    >
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index}>
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-1 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
