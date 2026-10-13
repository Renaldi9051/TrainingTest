"use client";

import { DownloadIcon, InboxIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { createDataTableColumns, type DataTableColumn } from "@/components/admin/data-table";
import { ResourceTable } from "@/components/admin/resource-table";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { useScopedId } from "@/hooks/use-scoped-id";
import type { Inquiry, InquiryStatus } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { INQUIRY_STATUS_LABELS } from "@/lib/labels";
import { InquiryStatusLabel } from "./inquiry-status";

const columnHelper = createDataTableColumns<Inquiry>();

const columns: DataTableColumn<Inquiry>[] = columnHelper.columns([
  columnHelper.accessor("createdAt", {
    header: "Masuk",
    cell: ({ getValue }) => <span className="text-small whitespace-nowrap text-fg-muted">{formatDateTime(getValue())}</span>,
  }),
  columnHelper.accessor("name", {
    header: "Nama",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link href={`/admin/inquiries/${row.original.id}`} className="font-medium text-fg-strong underline-offset-4 hover:underline">
          {row.original.name}
        </Link>
        <p className="truncate text-small text-fg-muted">{row.original.company ?? row.original.email}</p>
      </div>
    ),
  }),
  columnHelper.display({
    id: "training",
    header: "Pelatihan",
    cell: ({ row }) => (
      <span className="text-small">{row.original.training?.title ?? row.original.interest ?? <span className="text-fg-muted">-</span>}</span>
    ),
  }),
  columnHelper.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <InquiryStatusLabel status={getValue()} />,
  }),
]);

const SORTS = [
  { value: "-createdAt", label: "Terbaru" },
  { value: "createdAt", label: "Terlama" },
  { value: "name", label: "Nama A-Z" },
] as const;

const ALL = "all";
const STATUSES = Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatus[];
const isStatus = (value: string | null): value is InquiryStatus => value !== null && (STATUSES as string[]).includes(value);

export function InquiriesList() {
  const sid = useScopedId("inquiry-filter");
  const searchParams = useSearchParams();
  // ?status=NEW dari dashboard / badge sidebar.
  const [status, setStatus] = useState<string>(() => {
    const value = searchParams.get("status");
    return isStatus(value) ? value : ALL;
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = useMemo(
    () => ({ ...(status === ALL ? {} : { status }), ...(from ? { from } : {}), ...(to ? { to } : {}) }),
    [status, from, to],
  );
  const exportHref = `/api/admin/inquiries/export?${new URLSearchParams(params)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor={sid("from")}>Dari tanggal</Label>
            <Input id={sid("from")} type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor={sid("to")}>Sampai tanggal</Label>
            <Input id={sid("to")} type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-40" />
          </div>
        </div>
        {/* Unduhan biasa (cookie sesi ikut terkirim); filter sama dengan tabel, kecuali kata kunci. */}
        <Button variant="outline" asChild>
          <a href={exportHref} download>
            <DownloadIcon aria-hidden />
            Ekspor CSV
          </a>
        </Button>
      </div>
      <ResourceTable<Inquiry>
        resource="inquiries"
        columns={columns}
        rowLabel={(row) => row.name}
        sorts={SORTS}
        searchPlaceholder="Cari nama, email, atau instansi"
        unit="inquiry"
        params={params}
        filters={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36" aria-label="Filter status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua status</SelectItem>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {INQUIRY_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        empty={{
          icon: InboxIcon,
          title: "Belum ada inquiry",
          description: "Pesan dari form detail pelatihan dan halaman /kontak tampil di sini.",
        }}
      />
    </div>
  );
}
