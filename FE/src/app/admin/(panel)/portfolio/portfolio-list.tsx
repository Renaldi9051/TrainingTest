"use client";

import { ArrowUpDownIcon, ImageIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createDataTableColumns, type DataTableColumn } from "@/components/admin/data-table";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { OptionRow } from "@/components/admin/option-row";
import { ReorderPanel } from "@/components/admin/reorder-panel";
import { ResourceTable } from "@/components/admin/resource-table";
import { Button } from "@/components/admin/ui/button";
import { loadReorderOptions } from "@/lib/admin-resources";
import type { OptionItem, PortfolioItem } from "@/lib/api/types";
import { formatDate, formatNumber } from "@/lib/format";
import { portfolioKeys } from "./portfolio-form";

const columnHelper = createDataTableColumns<PortfolioItem>();

const columns: DataTableColumn<PortfolioItem>[] = columnHelper.columns([
  columnHelper.accessor("title", {
    header: "Judul",
    cell: ({ row }) => {
      const cover = row.original.images[0];
      return (
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative aspect-[4/3] w-14 shrink-0 overflow-hidden rounded-md border border-border bg-bg-subtle">
            {cover ? <MediaThumbnail media={cover} sizes="56px" /> : null}
          </span>
          <div className="min-w-0">
            <Link
              href={`/admin/portfolio/${row.original.id}`}
              className="font-medium text-fg-strong underline-offset-4 hover:underline"
            >
              {row.original.title}
            </Link>
            <p className="truncate text-small text-fg-muted">{row.original.client ?? "-"}</p>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor("date", {
    header: "Tanggal",
    cell: ({ getValue }) => {
      const value = getValue();
      return <span className="text-small text-fg-muted">{value ? formatDate(value) : "-"}</span>;
    },
  }),
  columnHelper.accessor("imageIds", {
    header: "Gambar",
    cell: ({ getValue }) => <span className="font-mono">{formatNumber(getValue().length)}</span>,
  }),
  columnHelper.display({
    id: "actions",
    header: () => <span className="sr-only">Aksi</span>,
    cell: ({ row }) => (
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={`/admin/portfolio/${row.original.id}`} aria-label={`Ubah ${row.original.title}`}>
          <PencilIcon strokeWidth={1.5} aria-hidden />
        </Link>
      </Button>
    ),
  }),
]);

const SORTS = [
  { value: "order", label: "Urutan" },
  { value: "-date", label: "Tanggal terbaru" },
  { value: "title", label: "Judul A-Z" },
] as const;

export function PortfolioList() {
  const [reordering, setReordering] = useState(false);
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
          queryKey={portfolioKeys.reorder}
          load={() => loadReorderOptions("portfolio")}
          reorderPath="/admin/portfolio/reorder"
          invalidateKey={portfolioKeys.all}
          itemLabel={(item) => item.label}
          noun="portofolio"
          emptyIcon={ImageIcon}
          renderItem={(item) => <OptionRow item={item} />}
        />
      ) : (
        <ResourceTable<PortfolioItem>
          resource="portfolio"
          columns={columns}
          rowLabel={(row) => row.title}
          sorts={SORTS}
          searchPlaceholder="Cari judul atau klien"
          unit="portofolio"
          empty={{
            icon: ImageIcon,
            title: "Belum ada portofolio",
            description: "Dokumentasi kegiatan tampil di halaman /profil/portofolio.",
            action: (
              <Button asChild>
                <Link href="/admin/portfolio/new">Tambah portofolio</Link>
              </Button>
            ),
          }}
        />
      )}
    </div>
  );
}
