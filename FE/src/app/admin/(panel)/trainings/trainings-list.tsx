"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  createDataTableColumns,
  DataTable,
  DataTableToolbar,
  type DataTableColumn,
  type RowSelectionState,
} from "@/components/admin/data-table";
import { PublicStateLabel } from "@/components/admin/status-dot";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type {
  CategoryOption,
  PaginationMeta,
  Training,
  TrainingBulkAction,
  TrainingBulkResult,
  TrainingListItem,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { METHOD_LABELS } from "@/lib/labels";
import { categoryKeys } from "../categories/category-form";
import { trainingKeys } from "./training-keys";

const ALL = "all";
const EMPTY: TrainingListItem[] = [];

const SORTS = [
  { value: "-updatedAt", label: "Terakhir diubah" },
  { value: "-publishedAt", label: "Terbaru tayang" },
  { value: "title", label: "Judul A-Z" },
] as const;

export function previewHref(id: string) {
  return `/admin/preview?type=training&id=${id}`;
}

function RowActions({ training }: { training: TrainingListItem }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const duplicate = useMutation({
    mutationFn: async () => (await apiSend<Training>(`/admin/trainings/${training.id}/duplicate`, "POST")).data,
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      toast.success("Salinan dibuat sebagai draf.");
      router.push(`/admin/trainings/${copy.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${training.title}`}>
          <MoreHorizontalIcon strokeWidth={1.5} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/admin/trainings/${training.id}`}>
            <PencilIcon aria-hidden />
            Ubah
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={duplicate.isPending} onSelect={() => duplicate.mutate()}>
          <CopyIcon aria-hidden />
          Duplikat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={previewHref(training.id)} target="_blank" rel="noreferrer">
            <EyeIcon aria-hidden />
            Pratinjau
          </a>
        </DropdownMenuItem>
        {training.publicState === "PUBLISHED" ? (
          <DropdownMenuItem asChild>
            <a href={`/pelatihan/${training.slug}`} target="_blank" rel="noreferrer">
              <ExternalLinkIcon aria-hidden />
              Lihat di situs
            </a>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columnHelper = createDataTableColumns<TrainingListItem>();

const columns: DataTableColumn<TrainingListItem>[] = columnHelper.columns([
  columnHelper.accessor("title", {
    header: "Judul",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[36rem]">
        <Link
          href={`/admin/trainings/${row.original.id}`}
          className="font-medium text-fg-strong underline-offset-4 hover:underline"
        >
          {row.original.title}
        </Link>
        <p className="truncate font-mono text-xs text-fg-muted">{row.original.slug}</p>
        {row.original.categories.length > 0 ? (
          <p className="mt-1 truncate text-small text-fg-muted">
            {row.original.categories.map((category) => category.name).join(", ")}
          </p>
        ) : null}
      </div>
    ),
  }),
  columnHelper.accessor("publicState", {
    header: "Status",
    cell: ({ row }) => (
      <div>
        <PublicStateLabel state={row.original.publicState} />
        {row.original.publicState !== "DRAFT" && row.original.publishedAt ? (
          <p className="mt-1 text-xs text-fg-muted">{formatDateTime(row.original.publishedAt)}</p>
        ) : null}
      </div>
    ),
  }),
  columnHelper.accessor("method", {
    header: "Metode",
    cell: ({ getValue }) => {
      const method = getValue();
      return method ? METHOD_LABELS[method] : <span className="text-fg-muted">-</span>;
    },
  }),
  columnHelper.accessor("scheduleCount", {
    header: "Jadwal",
    cell: ({ row }) => (
      <Link
        href={`/admin/schedules?trainingId=${row.original.id}`}
        className="font-mono underline-offset-4 hover:underline"
        aria-label={`${row.original.scheduleCount} jadwal untuk ${row.original.title}`}
      >
        {row.original.scheduleCount}
      </Link>
    ),
  }),
  columnHelper.accessor("updatedAt", {
    header: "Diperbarui",
    cell: ({ getValue }) => <span className="text-small text-fg-muted">{formatDateTime(getValue())}</span>,
  }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Aksi</span>,
    cell: ({ row }) => <RowActions training={row.original} />,
  }),
]);

type BulkDialog = "publish" | "unpublish" | "delete" | "set-category" | null;

export function TrainingsList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [status, setStatus] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [method, setMethod] = useState<string>(ALL);
  const [sort, setSort] = useState<string>("-updatedAt");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null);
  const [targetCategory, setTargetCategory] = useState<string>("");
  const [bulkReport, setBulkReport] = useState<TrainingBulkResult | null>(null);

  const params = useMemo(() => ({ q, status, categoryId, method, sort, page }), [q, status, categoryId, method, sort, page]);
  const query = useQuery({
    queryKey: trainingKeys.list(params),
    queryFn: async () => {
      const search = new URLSearchParams({ page: String(page), pageSize: "20", sort });
      if (q) search.set("q", q);
      if (status !== ALL) search.set("status", status);
      if (categoryId !== ALL) search.set("categoryId", categoryId);
      if (method !== ALL) search.set("method", method);
      return apiFetch<TrainingListItem[], PaginationMeta>(`/admin/trainings?${search}`);
    },
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: categoryKeys.options,
    queryFn: async () => (await apiFetch<CategoryOption[]>("/admin/categories/options")).data,
  });

  const selectedIds = Object.keys(selection).filter((id) => selection[id]);
  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
    setSelection({});
  };

  const bulk = useMutation({
    mutationFn: async (body: TrainingBulkAction) =>
      (await apiSend<TrainingBulkResult>("/admin/trainings/bulk", "POST", body)).data,
    onSuccess: async (result, body) => {
      await queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      setSelection({});
      setBulkDialog(null);
      setTargetCategory("");
      const verb = {
        publish: "ditayangkan",
        unpublish: "dijadikan draf",
        delete: "dipindahkan ke Sampah",
        "set-category": "dipindahkan kategorinya",
      }[body.action];
      if (body.action === "publish" && result.skipped.length > 0) {
        // Laporan lengkap: berapa yang tayang, mana yang dilewati dan kenapa.
        setBulkReport(result);
        return;
      }
      toast.success(`${result.affected} pelatihan ${verb}.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const filtered = Boolean(q) || status !== ALL || categoryId !== ALL || method !== ALL;
  const count = selectedIds.length;
  const targetName = categories.data?.find((category) => category.id === targetCategory)?.name;

  return (
    <>
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
              Jadikan draf
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkDialog("set-category")}>
              Ganti semua kategori dengan...
            </Button>
            <Button size="sm" variant="outline" className="text-status-error" onClick={() => setBulkDialog("delete")}>
              Hapus
            </Button>
          </>
        }
        filters={
          <>
            <Select value={status} onValueChange={resetPage(setStatus)}>
              <SelectTrigger className="w-36" aria-label="Filter status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua status</SelectItem>
                <SelectItem value="PUBLISHED">Tayang</SelectItem>
                <SelectItem value="SCHEDULED">Terjadwal</SelectItem>
                <SelectItem value="DRAFT">Draf</SelectItem>
              </SelectContent>
            </Select>
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
            <Select value={method} onValueChange={resetPage(setMethod)}>
              <SelectTrigger className="w-32" aria-label="Filter metode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua metode</SelectItem>
                {Object.entries(METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={resetPage(setSort)}>
              <SelectTrigger className="w-40" aria-label="Urutkan daftar">
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
        unit="pelatihan"
        empty={{
          icon: BookOpenIcon,
          title: filtered ? "Tidak ada pelatihan yang cocok" : "Belum ada pelatihan",
          description: filtered ? "Ubah kata kunci atau filter." : "Tambahkan pelatihan pertama untuk mengisi katalog.",
          action: filtered ? undefined : (
            <Button asChild>
              <Link href="/admin/trainings/new">Tambah pelatihan</Link>
            </Button>
          ),
        }}
      />

      <ConfirmDialog
        open={bulkDialog === "publish" || bulkDialog === "unpublish" || bulkDialog === "delete"}
        onOpenChange={(open) => (!open ? setBulkDialog(null) : undefined)}
        title={
          bulkDialog === "publish"
            ? `Tayangkan ${count} pelatihan?`
            : bulkDialog === "unpublish"
              ? `Jadikan ${count} pelatihan sebagai draf?`
              : `Hapus ${count} pelatihan?`
        }
        description={
          bulkDialog === "publish"
            ? "Pelatihan terpilih langsung tampil di situs. Yang terjadwal ikut tayang sekarang. Pelatihan yang belum punya 4-8 hasil belajar dilewati."
            : bulkDialog === "unpublish"
              ? "Pelatihan terpilih disembunyikan dari situs."
              : "Pelatihan terpilih dipindahkan ke Sampah dan hilang dari situs. Bisa dipulihkan dalam 30 hari."
        }
        confirmLabel={bulkDialog === "publish" ? "Tayangkan" : bulkDialog === "unpublish" ? "Jadikan draf" : "Hapus"}
        destructive={bulkDialog === "delete"}
        pending={bulk.isPending}
        onConfirm={() => {
          if (bulkDialog === "publish" || bulkDialog === "unpublish" || bulkDialog === "delete") {
            bulk.mutate({ action: bulkDialog, ids: selectedIds });
          }
        }}
      />

      <ConfirmDialog
        open={bulkDialog === "set-category"}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDialog(null);
            setTargetCategory("");
          }
        }}
        title={`Ganti semua kategori ${count} pelatihan?`}
        description={
          targetName
            ? `Semua kategori lama pada ${count} pelatihan terpilih dihapus dan diganti dengan "${targetName}".`
            : `Pilih kategori pengganti. Semua kategori lama pada ${count} pelatihan terpilih akan dihapus.`
        }
        confirmLabel="Ganti kategori"
        pending={bulk.isPending}
        onConfirm={() => {
          if (!targetCategory) {
            toast.error("Pilih kategori pengganti dulu.");
            return;
          }
          bulk.mutate({ action: "set-category", ids: selectedIds, categoryId: targetCategory });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="bulk-category">Kategori pengganti</Label>
          <Select value={targetCategory} onValueChange={setTargetCategory}>
            <SelectTrigger id="bulk-category" className="w-full">
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {(categories.data ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>

      <Dialog open={bulkReport !== null} onOpenChange={(open) => (!open ? setBulkReport(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bulkReport?.affected ?? 0} dipublikasikan, {bulkReport?.skipped.length ?? 0} dilewati
            </DialogTitle>
            <DialogDescription>
              Pelatihan berikut belum memenuhi syarat tayang dan tetap sebagai draf. Lengkapi lalu tayangkan lagi.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 divide-y divide-border overflow-y-auto border-y border-border">
            {bulkReport?.skipped.map((item) => (
              <li key={item.id} className="py-3">
                <Link
                  href={`/admin/trainings/${item.id}`}
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
