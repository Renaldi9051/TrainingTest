"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, NewspaperIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkSelectionSummary } from "@/components/admin/bulk-selection-summary";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  createDataTableColumns,
  DataTable,
  DataTableToolbar,
  type DataTableColumn,
  type RowSelectionState,
} from "@/components/admin/data-table";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { PublicStateLabel } from "@/components/admin/status-dot";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type {
  ArticleBulkAction,
  ArticleBulkResult,
  ArticleCategory,
  ArticleListItem,
  ArticleListMeta,
  ArticlePublicState,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { articleKeys, articlePreviewHref } from "./article-keys";

const ALL = "all";
const EMPTY: ArticleListItem[] = [];

const STATUS_TABS: { value: typeof ALL | ArticlePublicState; label: string; countKey: "ALL" | ArticlePublicState }[] = [
  { value: ALL, label: "Semua", countKey: "ALL" },
  { value: "DRAFT", label: "Draf", countKey: "DRAFT" },
  { value: "SCHEDULED", label: "Terjadwal", countKey: "SCHEDULED" },
  { value: "PUBLISHED", label: "Tayang", countKey: "PUBLISHED" },
];

const SORTS = [
  { value: "-updatedAt", label: "Terakhir diubah" },
  { value: "-publishedAt", label: "Waktu tayang terbaru" },
  { value: "publishedAt", label: "Waktu tayang terdekat" },
  { value: "title", label: "Judul A-Z" },
] as const;

type RowAction = { action: ArticleBulkAction["action"]; item: ArticleListItem } | null;

const ACTION_COPY = {
  publish: {
    title: (title: string) => `Tayangkan "${title}" sekarang?`,
    description: "Artikel langsung tampil di situs. Artikel terjadwal ikut tayang sekarang.",
    confirm: "Tayangkan",
    done: "Artikel ditayangkan.",
  },
  unpublish: {
    title: (title: string) => `Tarik "${title}" dari situs?`,
    description: "Artikel kembali menjadi draf dan tidak tampil di situs.",
    confirm: "Tarik",
    done: "Artikel ditarik menjadi draf.",
  },
  delete: {
    title: (title: string) => `Hapus "${title}"?`,
    description: "Artikel dipindahkan ke Sampah dan hilang dari situs.",
    confirm: "Hapus",
    done: "Artikel dipindahkan ke Sampah.",
  },
} as const;

function useArticleColumns(onAction: (action: RowAction) => void): DataTableColumn<ArticleListItem>[] {
  return useMemo(() => {
    const columnHelper = createDataTableColumns<ArticleListItem>();
    return columnHelper.columns([
      columnHelper.display({
        id: "cover",
        header: () => <span className="sr-only">Sampul</span>,
        cell: ({ row }) => (
          <div className="relative aspect-[4/3] w-16 overflow-hidden rounded-md border border-border bg-bg-subtle">
            {row.original.cover ? <MediaThumbnail media={row.original.cover} sizes="64px" /> : null}
          </div>
        ),
      }),
      columnHelper.accessor("title", {
        header: "Judul",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[24rem]">
            <Link
              href={`/admin/articles/${row.original.id}`}
              className="font-medium text-fg-strong underline-offset-4 hover:underline"
            >
              {row.original.title}
            </Link>
            <p className="mt-0.5 truncate text-small text-fg-muted">
              Oleh {row.original.authorName} · <span className="font-mono text-xs">/artikel/{row.original.slug}</span>
            </p>
          </div>
        ),
      }),
      columnHelper.accessor("category", {
        header: "Kategori",
        cell: ({ getValue }) => getValue()?.name ?? <span className="text-fg-muted">-</span>,
      }),
      columnHelper.accessor("publicState", {
        header: "Status",
        cell: ({ row }) => (
          <div>
            <PublicStateLabel state={row.original.publicState} />
            {row.original.publicState !== "DRAFT" && row.original.publishedAt ? (
              <p className="mt-1 text-xs text-fg-muted">{formatDateTime(row.original.publishedAt)} WIB</p>
            ) : null}
          </div>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => {
          const item = row.original;
          const live = item.publicState !== "DRAFT";
          return (
            // Ringkas supaya muat di samping kolom lain (1280 px): ikon untuk Ubah/Pratinjau/Hapus
            // (label lengkap di aria-label & tooltip), teks untuk aksi publikasi.
            <div className="flex flex-nowrap items-center justify-end gap-1">
              <Button variant="outline" size="icon-sm" asChild>
                <Link href={`/admin/articles/${item.id}`} aria-label={`Ubah ${item.title}`} title="Ubah">
                  <PencilIcon aria-hidden />
                </Link>
              </Button>
              <Button variant="ghost" size="icon-sm" asChild>
                <a
                  href={articlePreviewHref(item.id)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Pratinjau ${item.title}`}
                  title="Pratinjau"
                >
                  <EyeIcon aria-hidden />
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction({ action: live ? "unpublish" : "publish", item })}
                aria-label={`${live ? "Tarik" : "Tayangkan"} ${item.title}`}
              >
                {live ? "Tarik" : "Tayangkan"}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-status-error"
                onClick={() => onAction({ action: "delete", item })}
                aria-label={`Hapus ${item.title}`}
                title="Hapus"
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
          );
        },
      }),
    ]);
  }, [onAction]);
}

export function ArticlesList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [status, setStatus] = useState<typeof ALL | ArticlePublicState>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [sort, setSort] = useState<string>("-updatedAt");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [rowAction, setRowAction] = useState<RowAction>(null);
  const [bulkDialog, setBulkDialog] = useState<ArticleBulkAction["action"] | null>(null);
  const [bulkReport, setBulkReport] = useState<ArticleBulkResult | null>(null);

  const params = useMemo(() => ({ q, status, categoryId, sort, page }), [q, status, categoryId, sort, page]);
  const query = useQuery({
    queryKey: articleKeys.list(params),
    queryFn: async () => {
      const search = new URLSearchParams({ page: String(page), pageSize: "20", sort });
      if (q) search.set("q", q);
      if (status !== ALL) search.set("status", status);
      if (categoryId !== ALL) search.set("categoryId", categoryId);
      return apiFetch<ArticleListItem[], ArticleListMeta>(`/admin/articles?${search}`);
    },
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: articleKeys.categories,
    queryFn: async () => (await apiFetch<ArticleCategory[]>("/admin/article-categories")).data,
  });

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
    setSelection({});
  };

  const bulk = useMutation({
    mutationFn: async (body: ArticleBulkAction) =>
      (await apiSend<ArticleBulkResult>("/admin/articles/bulk", "POST", body)).data,
    onSuccess: async (result, body) => {
      await queryClient.invalidateQueries({ queryKey: articleKeys.all });
      await queryClient.invalidateQueries({ queryKey: articleKeys.categories });
      setSelection({});
      setBulkDialog(null);
      setRowAction(null);
      if (body.action === "publish" && result.skipped.length > 0) {
        setBulkReport(result);
        return;
      }
      if (body.ids.length === 1) {
        toast.success(ACTION_COPY[body.action].done);
        return;
      }
      const verb = { publish: "ditayangkan", unpublish: "ditarik menjadi draf", delete: "dipindahkan ke Sampah" }[
        body.action
      ];
      toast.success(`${result.affected} artikel ${verb}.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const columns = useArticleColumns(setRowAction);
  const counts = query.data?.meta?.counts;
  const selectedIds = Object.keys(selection).filter((id) => selection[id]);
  const count = selectedIds.length;
  const selectedItems = (query.data?.data ?? EMPTY).filter((row) => selection[row.id]);
  const filtered = Boolean(q) || status !== ALL || categoryId !== ALL;

  return (
    <>
      <div role="group" aria-label="Filter status" className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={active}
              onClick={() => resetPage(setStatus)(tab.value)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-fg-strong font-medium text-fg-strong" : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {tab.label}
              {counts ? <span className="font-mono text-xs text-fg-muted">{counts[tab.countKey]}</span> : null}
            </button>
          );
        })}
      </div>
      <DataTableToolbar
        search={search}
        onSearchChange={resetPage(setSearch)}
        searchPlaceholder="Cari judul atau slug"
        selectedCount={count}
        onClearSelection={() => setSelection({})}
        bulkActions={
          <>
            <Button size="sm" variant="outline" onClick={() => setBulkDialog("publish")}>
              Tayangkan
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkDialog("unpublish")}>
              Tarik ke draf
            </Button>
            <Button size="sm" variant="outline" className="text-status-error" onClick={() => setBulkDialog("delete")}>
              Hapus
            </Button>
          </>
        }
        filters={
          <>
            <Select value={categoryId} onValueChange={resetPage(setCategoryId)}>
              <SelectTrigger className="w-44" aria-label="Filter kategori">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua kategori</SelectItem>
                {(categories.data ?? []).map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={resetPage(setSort)}>
              <SelectTrigger className="w-48" aria-label="Urutkan daftar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <DataTable
        columns={columns}
        data={query.data?.data ?? EMPTY}
        rowLabel={(row) => row.title}
        isPending={query.isPending}
        isError={query.isError}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        selection={{ value: selection, onChange: setSelection, disabled: query.isPlaceholderData }}
        meta={query.data?.meta}
        onPageChange={(next) => {
          setPage(next);
          setSelection({});
        }}
        unit="artikel"
        empty={{
          icon: NewspaperIcon,
          title: filtered ? "Tidak ada artikel yang cocok" : "Belum ada artikel",
          description: filtered ? "Ubah kata kunci atau filter." : "Tulis artikel pertama untuk mengisi halaman /artikel.",
          action: filtered ? undefined : (
            <Button asChild>
              <Link href="/admin/articles/new">Tulis artikel</Link>
            </Button>
          ),
        }}
      />

      <ConfirmDialog
        open={rowAction !== null}
        onOpenChange={(open) => (!open ? setRowAction(null) : undefined)}
        title={rowAction ? ACTION_COPY[rowAction.action].title(rowAction.item.title) : ""}
        description={rowAction ? ACTION_COPY[rowAction.action].description : ""}
        confirmLabel={rowAction ? ACTION_COPY[rowAction.action].confirm : ""}
        destructive={rowAction?.action === "delete"}
        pending={bulk.isPending}
        onConfirm={() => {
          if (rowAction) bulk.mutate({ action: rowAction.action, ids: [rowAction.item.id] });
        }}
      />

      <ConfirmDialog
        open={bulkDialog !== null}
        onOpenChange={(open) => (!open ? setBulkDialog(null) : undefined)}
        title={
          bulkDialog === "publish"
            ? `Tayangkan ${count} artikel?`
            : bulkDialog === "unpublish"
              ? `Tarik ${count} artikel ke draf?`
              : `Hapus ${count} artikel?`
        }
        description={
          bulkDialog === "publish"
            ? "Artikel terpilih langsung tampil di situs. Yang terjadwal ikut tayang sekarang. Artikel tanpa isi dilewati."
            : bulkDialog === "unpublish"
              ? "Artikel terpilih disembunyikan dari situs."
              : "Artikel terpilih dipindahkan ke Sampah dan hilang dari situs."
        }
        confirmLabel={bulkDialog === "publish" ? "Tayangkan" : bulkDialog === "unpublish" ? "Tarik" : "Hapus"}
        destructive={bulkDialog === "delete"}
        pending={bulk.isPending}
        onConfirm={() => {
          if (bulkDialog) bulk.mutate({ action: bulkDialog, ids: selectedIds });
        }}
      >
        <BulkSelectionSummary items={selectedItems} total={count} label="Artikel terpilih" />
      </ConfirmDialog>

      <Dialog open={bulkReport !== null} onOpenChange={(open) => (!open ? setBulkReport(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkReport?.affected ?? 0} ditayangkan, {bulkReport?.skipped.length ?? 0} dilewati
            </DialogTitle>
            <DialogDescription>Artikel berikut belum punya isi dan tetap sebagai draf.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 divide-y divide-border overflow-y-auto border-y border-border">
            {bulkReport?.skipped.map((item) => (
              <li key={item.id} className="py-3">
                <Link
                  href={`/admin/articles/${item.id}`}
                  className="font-medium text-fg-strong underline-offset-4 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-small text-fg-muted">{item.reason}</p>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button onClick={() => setBulkReport(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
