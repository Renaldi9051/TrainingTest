"use client";

import { EyeIcon, FileTextIcon, LockIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createDataTableColumns, type DataTableColumn } from "@/components/admin/data-table";
import { ResourceTable } from "@/components/admin/resource-table";
import { PublicStateLabel } from "@/components/admin/status-dot";
import { Button } from "@/components/admin/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import type { PageListItem } from "@/lib/api/types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { pagePath, pagePreviewHref } from "./page-form";

const columnHelper = createDataTableColumns<PageListItem>();

const columns: DataTableColumn<PageListItem>[] = columnHelper.columns([
  columnHelper.accessor("title", {
    header: "Judul",
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/pages/${row.original.id}`}
            className="font-medium text-fg-strong underline-offset-4 hover:underline"
          >
            {row.original.title}
          </Link>
          {row.original.kind === "PROFILE" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 font-mono text-[10px] uppercase text-fg-muted">
              <LockIcon className="size-3" strokeWidth={1.5} aria-hidden />
              Sistem
            </span>
          ) : null}
        </div>
        <p className="truncate font-mono text-xs text-fg-muted">{pagePath(row.original)}</p>
      </div>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <PublicStateLabel state={getValue()} />,
  }),
  columnHelper.accessor("blockCount", {
    header: "Blok",
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
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon-sm" asChild>
          <a
            href={pagePreviewHref(row.original.id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Pratinjau ${row.original.title} (tab baru)`}
          >
            <EyeIcon strokeWidth={1.5} aria-hidden />
          </a>
        </Button>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/admin/pages/${row.original.id}`} aria-label={`Ubah ${row.original.title}`}>
            <PencilIcon strokeWidth={1.5} aria-hidden />
          </Link>
        </Button>
      </div>
    ),
  }),
]);

const SORTS = [
  { value: "-updatedAt", label: "Terakhir diubah" },
  { value: "title", label: "Judul A-Z" },
] as const;

const ALL = "all";

// Halaman profil (sistem) selalu di urutan teratas (diurutkan BE).
export function PagesList() {
  const [status, setStatus] = useState(ALL);
  return (
    <ResourceTable<PageListItem>
      resource="pages"
      columns={columns}
      rowLabel={(row) => row.title}
      sorts={SORTS}
      searchPlaceholder="Cari judul atau slug"
      unit="halaman"
      params={status === ALL ? undefined : { status }}
      filters={
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36" aria-label="Filter status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua status</SelectItem>
            <SelectItem value="PUBLISHED">Tayang</SelectItem>
            <SelectItem value="DRAFT">Draf</SelectItem>
          </SelectContent>
        </Select>
      }
      empty={{
        icon: FileTextIcon,
        title: "Belum ada halaman",
        description: "Halaman statis seperti Syarat & Ketentuan atau Kebijakan Privasi.",
        action: (
          <Button asChild>
            <Link href="/admin/pages/new">Tambah halaman</Link>
          </Button>
        ),
      }}
    />
  );
}
