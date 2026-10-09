"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDownIcon, FolderTreeIcon, PencilIcon, StarIcon } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createDataTableColumns,
  DataTable,
  DataTableToolbar,
  type DataTableColumn,
} from "@/components/admin/data-table";
import { EmptyState } from "@/components/admin/empty-state";
import { SortableList } from "@/components/admin/sortable-list";
import { TableSkeleton } from "@/components/admin/table-skeleton";
import { Button } from "@/components/admin/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { Category, CategoryOption, PaginationMeta } from "@/lib/api/types";
import { categoryIcon } from "@/lib/category-icons";
import { formatDateTime, formatNumber } from "@/lib/format";
import { categoryKeys } from "./category-form";

const columnHelper = createDataTableColumns<Category>();

const columns: DataTableColumn<Category>[] = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Nama",
    cell: ({ row }) => {
      const Icon = categoryIcon(row.original.icon);
      return (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-fg-muted">
            {Icon ? <Icon className="size-4" strokeWidth={1.5} aria-hidden /> : null}
          </span>
          <div className="min-w-0">
            <Link
              href={`/admin/categories/${row.original.id}`}
              className="font-medium text-fg-strong underline-offset-4 hover:underline"
            >
              {row.original.name}
            </Link>
            <p className="truncate font-mono text-xs text-fg-muted">{row.original.slug}</p>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor("featured", {
    header: "Unggulan",
    cell: ({ getValue }) =>
      getValue() ? (
        <span className="inline-flex items-center gap-1 font-mono text-xs uppercase">
          <StarIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
          Ya
        </span>
      ) : (
        <span className="text-fg-muted">-</span>
      ),
  }),
  columnHelper.accessor("trainingCount", {
    header: "Pelatihan",
    cell: ({ getValue }) => <span className="font-mono">{formatNumber(getValue())}</span>,
  }),
  columnHelper.accessor("updatedAt", {
    header: "Diperbarui",
    cell: ({ getValue }) => <span className="text-small text-fg-muted">{formatDateTime(getValue())}</span>,
  }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Aksi</span>,
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={`/admin/categories/${row.original.id}`} aria-label={`Ubah ${row.original.name}`}>
          <PencilIcon strokeWidth={1.5} aria-hidden />
        </Link>
      </Button>
    ),
  }),
]);

const SORTS = [
  { value: "order", label: "Urutan" },
  { value: "name", label: "Nama A-Z" },
  { value: "-updatedAt", label: "Terakhir diubah" },
] as const;

const FEATURED_ALL = "all";

export function CategoriesList() {
  const [reordering, setReordering] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant={reordering ? "default" : "outline"} onClick={() => setReordering((current) => !current)}>
          <ArrowUpDownIcon aria-hidden />
          {reordering ? "Selesai mengurutkan" : "Urutkan"}
        </Button>
      </div>
      {reordering ? <CategoryReorder /> : <CategoryTable />}
    </div>
  );
}

function CategoryTable() {
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [sort, setSort] = useState<string>("order");
  const [featured, setFeatured] = useState<string>(FEATURED_ALL);
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({ q, sort, featured, page }), [q, sort, featured, page]);
  const query = useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: async () => {
      const search = new URLSearchParams({ page: String(page), pageSize: "20", sort });
      if (q) search.set("q", q);
      if (featured !== FEATURED_ALL) search.set("featured", featured);
      return apiFetch<Category[], PaginationMeta>(`/admin/categories?${search}`);
    },
    placeholderData: keepPreviousData,
  });

  const filtered = Boolean(q) || featured !== FEATURED_ALL;

  return (
    <>
      <DataTableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Cari nama atau slug"
        filters={
          <>
            <Select
              value={featured}
              onValueChange={(value) => {
                setFeatured(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40" aria-label="Filter unggulan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FEATURED_ALL}>Semua</SelectItem>
                <SelectItem value="true">Unggulan</SelectItem>
                <SelectItem value="false">Bukan unggulan</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-44" aria-label="Urutkan daftar">
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
        rowLabel={(row) => row.name}
        isPending={query.isPending}
        isError={query.isError}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        unit="kategori"
        empty={{
          icon: FolderTreeIcon,
          title: filtered ? "Tidak ada kategori yang cocok" : "Belum ada kategori",
          description: filtered
            ? "Ubah kata kunci atau filter."
            : "Kategori mengelompokkan pelatihan di katalog publik.",
          action: filtered ? undefined : (
            <Button asChild>
              <Link href="/admin/categories/new">Tambah kategori</Link>
            </Button>
          ),
        }}
      />
    </>
  );
}

const EMPTY: Category[] = [];

// Mode urutkan: semua kategori aktif dalam satu daftar drag & drop.
function CategoryReorder() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: categoryKeys.options,
    queryFn: async () => (await apiFetch<CategoryOption[]>("/admin/categories/options")).data,
  });

  const save = useMutation({
    mutationFn: async (ids: string[]) => apiSend("/admin/categories/reorder", "POST", { ids }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success("Urutan kategori disimpan.");
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Urutan gagal disimpan."));
      void queryClient.invalidateQueries({ queryKey: categoryKeys.options });
    },
  });

  if (query.isPending) return <TableSkeleton rows={8} columns={2} />;
  if (query.isError) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
        <p className="text-small text-status-error">Kategori tidak dapat dimuat.</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  }
  if (query.data.length === 0) {
    return <EmptyState icon={FolderTreeIcon} title="Belum ada kategori untuk diurutkan" />;
  }

  return (
    <SortableList
      items={query.data}
      itemLabel={(item) => item.name}
      disabled={save.isPending}
      onReorder={(ids) => {
        queryClient.setQueryData<CategoryOption[]>(categoryKeys.options, (current) =>
          current ? ids.map((id) => current.find((item) => item.id === id)).filter((item): item is CategoryOption => Boolean(item)) : current,
        );
        save.mutate(ids);
      }}
      renderItem={(item, handle) => (
        <div className="flex items-center gap-3 py-2">
          {handle}
          <span className="font-medium text-fg-strong">{item.name}</span>
          <span className="truncate font-mono text-xs text-fg-muted">{item.slug}</span>
        </div>
      )}
    />
  );
}
