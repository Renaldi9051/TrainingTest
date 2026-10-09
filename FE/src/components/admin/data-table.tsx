"use client";

import {
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, type LucideIcon } from "lucide-react";
import { useId, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { EmptyState } from "@/components/admin/empty-state";
import { TableSkeleton } from "@/components/admin/table-skeleton";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Input } from "@/components/admin/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import type { PaginationMeta } from "@/lib/api/types";
import { cn } from "@/lib/utils";

// Tabel admin standar: data & paginasi dari server (TanStack Query), TanStack Table hanya untuk
// kolom dan pilihan baris (bulk action). Sort/filter/paginasi dikelola caller lewat query BE.

export const dataTableFeatures = tableFeatures({ rowSelectionFeature });
type Features = typeof dataTableFeatures;

export type DataTableColumn<TData extends { id: string }> = ColumnDef<Features, TData>;

export function createDataTableColumns<TData extends { id: string }>() {
  return createColumnHelper<Features, TData>();
}

export type { RowSelectionState };

type DataTableProps<TData extends { id: string }> = {
  columns: DataTableColumn<TData>[];
  data: TData[];
  // Label baris untuk pembaca layar, mis. judul pelatihan ("Pilih <label>").
  rowLabel: (row: TData) => string;
  isPending: boolean;
  isError: boolean;
  isFetching?: boolean;
  onRetry: () => void;
  empty: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode };
  // Pilihan baris untuk bulk action; tanpa ini kolom checkbox tidak tampil.
  // disabled: mis. saat tabel masih menampilkan data lama (filter baru sedang dimuat), supaya
  // admin tidak memilih baris yang sebentar lagi berganti.
  selection?: {
    value: RowSelectionState;
    onChange: Dispatch<SetStateAction<RowSelectionState>>;
    disabled?: boolean;
  };
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
  // Satuan untuk ringkasan paginasi, mis. "pelatihan".
  unit?: string;
};

export function DataTable<TData extends { id: string }>({
  columns,
  data,
  rowLabel,
  isPending,
  isError,
  isFetching,
  onRetry,
  empty,
  selection,
  meta,
  onPageChange,
  unit = "item",
}: DataTableProps<TData>) {
  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId: (row) => row.id,
    enableRowSelection: Boolean(selection),
    state: { rowSelection: selection?.value ?? {} },
    onRowSelectionChange: (updater) => selection?.onChange(updater),
  });

  if (isPending) return <TableSkeleton rows={8} columns={Math.min(columns.length, 5)} />;

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
        <p className="text-small text-status-error">Data tidak dapat dimuat.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState icon={empty.icon} title={empty.title} description={empty.description} action={empty.action} />
    );
  }

  const allSelected = table.getIsAllPageRowsSelected();
  const someSelected = table.getIsSomePageRowsSelected();

  return (
    <div className="space-y-4">
      <Table aria-busy={isFetching}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {selection ? (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Pilih semua di halaman ini"
                    disabled={selection.disabled}
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
                  />
                </TableHead>
              ) : null}
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
              {selection ? (
                <TableCell className="w-10">
                  <Checkbox
                    aria-label={`Pilih ${rowLabel(row.original)}`}
                    disabled={selection.disabled}
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(checked === true)}
                  />
                </TableCell>
              ) : null}
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {meta && onPageChange ? <DataTablePagination meta={meta} onPageChange={onPageChange} unit={unit} /> : null}
    </div>
  );
}

export function DataTablePagination({
  meta,
  onPageChange,
  unit,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  unit: string;
}) {
  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Paginasi">
      <p className="text-small text-fg-muted">
        {meta.total} {unit} · halaman {meta.page} dari {meta.totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeftIcon aria-hidden />
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          Berikutnya
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

type DataTableToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  // Filter tambahan (select status, kategori, ...).
  filters?: ReactNode;
  // Jumlah baris terpilih dan tombol bulk action; bar bulk tampil kalau selectedCount > 0.
  selectedCount?: number;
  bulkActions?: ReactNode;
  onClearSelection?: () => void;
  className?: string;
};

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Cari",
  filters,
  selectedCount = 0,
  bulkActions,
  onClearSelection,
  className,
}: DataTableToolbarProps) {
  const searchId = useId();
  return (
    <div className={cn("mb-4 space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            {searchPlaceholder}
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
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
        {filters ? <div className="flex flex-wrap items-center gap-2">{filters}</div> : null}
      </div>
      {selectedCount > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-border-strong bg-bg-subtle px-3 py-2"
          role="region"
          aria-label="Aksi massal"
        >
          <p className="mr-2 text-small font-medium text-fg-strong">{selectedCount} dipilih</p>
          {bulkActions}
          {onClearSelection ? (
            <Button variant="ghost" size="sm" onClick={onClearSelection} className="ml-auto">
              Batal pilih
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
