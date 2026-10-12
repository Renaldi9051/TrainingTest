"use client";

import { ArrowUpDownIcon, EyeIcon, LayoutListIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createDataTableColumns, type DataTableColumn } from "@/components/admin/data-table";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { OptionRow } from "@/components/admin/option-row";
import { ReorderPanel } from "@/components/admin/reorder-panel";
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
import { loadReorderOptions } from "@/lib/admin-resources";
import type { OptionItem, ServiceListItem } from "@/lib/api/types";
import { categoryIcon } from "@/lib/category-icons";
import { formatDateTime } from "@/lib/format";
import { serviceKeys, servicePreviewHref } from "./service-form";

const columnHelper = createDataTableColumns<ServiceListItem>();

const columns: DataTableColumn<ServiceListItem>[] = columnHelper.columns([
  columnHelper.accessor("title", {
    header: "Judul",
    cell: ({ row }) => {
      const Icon = categoryIcon(row.original.icon);
      return (
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex aspect-[4/3] w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border text-fg-muted">
            {row.original.image ? (
              <MediaThumbnail media={row.original.image} sizes="56px" />
            ) : Icon ? (
              <Icon className="size-4" strokeWidth={1.5} aria-hidden />
            ) : null}
          </span>
          <div className="min-w-0">
            <Link
              href={`/admin/services/${row.original.id}`}
              className="font-medium text-fg-strong underline-offset-4 hover:underline"
            >
              {row.original.title}
            </Link>
            <p className="truncate font-mono text-xs text-fg-muted">/layanan/{row.original.slug}</p>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <PublicStateLabel state={getValue()} />,
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
            href={servicePreviewHref(row.original.id)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Pratinjau ${row.original.title} (tab baru)`}
          >
            <EyeIcon strokeWidth={1.5} aria-hidden />
          </a>
        </Button>
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/admin/services/${row.original.id}`} aria-label={`Ubah ${row.original.title}`}>
            <PencilIcon strokeWidth={1.5} aria-hidden />
          </Link>
        </Button>
      </div>
    ),
  }),
]);

const SORTS = [
  { value: "order", label: "Urutan" },
  { value: "title", label: "Judul A-Z" },
  { value: "-updatedAt", label: "Terakhir diubah" },
] as const;

const ALL = "all";

export function ServicesList() {
  const [reordering, setReordering] = useState(false);
  const [status, setStatus] = useState(ALL);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant={reordering ? "default" : "outline"} onClick={() => setReordering((current) => !current)}>
          <ArrowUpDownIcon aria-hidden />
          {reordering ? "Selesai mengurutkan" : "Urutkan"}
        </Button>
      </div>
      {reordering ? (
        <ReorderPanel<OptionItem>
          queryKey={serviceKeys.reorder}
          load={() => loadReorderOptions("services")}
          reorderPath="/admin/services/reorder"
          invalidateKey={serviceKeys.all}
          itemLabel={(item) => item.label}
          noun="layanan"
          emptyIcon={LayoutListIcon}
          renderItem={(item) => <OptionRow item={item} />}
        />
      ) : (
        <ResourceTable<ServiceListItem>
          resource="services"
          columns={columns}
          rowLabel={(row) => row.title}
          sorts={SORTS}
          searchPlaceholder="Cari judul atau slug"
          unit="layanan"
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
            icon: LayoutListIcon,
            title: "Belum ada layanan",
            description: "Layanan tampil sebagai baris bernomor di beranda dan di halaman /layanan.",
            action: (
              <Button asChild>
                <Link href="/admin/services/new">Tambah layanan</Link>
              </Button>
            ),
          }}
        />
      )}
    </div>
  );
}
