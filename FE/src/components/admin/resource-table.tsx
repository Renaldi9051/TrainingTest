"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { DataTable, DataTableToolbar, type DataTableColumn } from "@/components/admin/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { apiFetch } from "@/lib/api/client";
import type { PaginationMeta } from "@/lib/api/types";
import { resourceKeys, type AdminResource } from "@/lib/admin-resources";

type ResourceTableProps<TItem extends { id: string }> = {
  resource: AdminResource;
  columns: DataTableColumn<TItem>[];
  rowLabel: (row: TItem) => string;
  sorts: readonly { value: string; label: string }[];
  searchPlaceholder: string;
  // Satuan paginasi, mis. "klien".
  unit: string;
  empty: { icon: LucideIcon; title: string; description: string; action?: ReactNode };
  // Filter tambahan (query string) dan kontrolnya.
  params?: Record<string, string>;
  filters?: ReactNode;
};

// Referensi tetap untuk "belum ada data" supaya tabel tidak menghitung ulang setiap render.
const EMPTY: never[] = [];

// Tabel daftar admin standar: search, sort, paginasi, state loading/kosong/error (DESIGN 10).
export function ResourceTable<TItem extends { id: string }>({
  resource,
  columns,
  rowLabel,
  sorts,
  searchPlaceholder,
  unit,
  empty,
  params,
  filters,
}: ResourceTableProps<TItem>) {
  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [sort, setSort] = useState<string>(sorts[0]?.value ?? "order");
  const [page, setPage] = useState(1);

  const key = useMemo(() => ({ q, sort, page, ...params }), [q, sort, page, params]);
  const query = useQuery({
    queryKey: resourceKeys(resource).list(key),
    queryFn: async () => {
      const search = new URLSearchParams({ page: String(page), pageSize: "20", sort, ...params });
      if (q) search.set("q", q);
      return apiFetch<TItem[], PaginationMeta>(`/admin/${resource}?${search}`);
    },
    placeholderData: keepPreviousData,
  });

  const filtered = Boolean(q) || Object.keys(params ?? {}).length > 0;

  return (
    <>
      <DataTableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={searchPlaceholder}
        filters={
          <>
            {filters}
            <Select
              value={sort}
              onValueChange={(value) => {
                setSort(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44" aria-label="Urutkan daftar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sorts.map((option) => (
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
        rowLabel={rowLabel}
        isPending={query.isPending}
        isError={query.isError}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        unit={unit}
        empty={
          filtered
            ? { icon: empty.icon, title: `Tidak ada ${unit} yang cocok`, description: "Ubah kata kunci atau filter." }
            : empty
        }
      />
    </>
  );
}
