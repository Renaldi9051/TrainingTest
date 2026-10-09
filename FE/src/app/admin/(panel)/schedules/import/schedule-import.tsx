"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, DownloadIcon, FileUpIcon, Loader2Icon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/admin/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/admin/ui/table";
import { ApiError, apiSend } from "@/lib/api/client";
import type { ScheduleImportResult } from "@/lib/api/types";
import { formatDateRange, formatRupiah } from "@/lib/format";
import { METHOD_LABELS, SCHEDULE_STATUS_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { scheduleKeys } from "../schedules-list";

const MAX_BYTES = 1024 * 1024;

export function ScheduleImport() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; csv: string } | null>(null);
  const [preview, setPreview] = useState<ScheduleImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useMutation({
    mutationFn: async (csv: string) =>
      (await apiSend<ScheduleImportResult>("/admin/schedules/import", "POST", { csv, dryRun: true })).data,
    onSuccess: (result) => {
      setPreview(result);
      setError(null);
    },
    onError: (failure) => {
      setPreview(null);
      setError(failure instanceof ApiError ? failure.message : "CSV tidak dapat diperiksa. Coba lagi.");
    },
  });

  const commit = useMutation({
    mutationFn: async (csv: string) =>
      (await apiSend<ScheduleImportResult>("/admin/schedules/import", "POST", { csv, dryRun: false })).data,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["admin", "trainings"] });
      toast.success(`${result.created} jadwal berhasil diimport.`);
      router.push("/admin/schedules");
    },
    onError: (failure) => {
      if (failure instanceof ApiError && failure.code === "IMPORT_INVALID") {
        setPreview(failure.details as ScheduleImportResult);
      }
      toast.error(failure instanceof ApiError ? failure.message : "Import gagal. Tidak ada data yang disimpan.");
    },
  });

  async function onFile(selected: File | undefined) {
    if (!selected) return;
    setPreview(null);
    if (selected.size > MAX_BYTES) {
      setFile(null);
      setError("File CSV maksimal 1 MB.");
      return;
    }
    const csv = await selected.text();
    setFile({ name: selected.name, csv });
    check.mutate(csv);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const busy = check.isPending || commit.isPending;

  return (
    <div className="space-y-8">
      <ol className="grid gap-6 border-y border-border py-6 md:grid-cols-3">
        <li>
          <p className="font-mono text-label uppercase text-fg-muted">01 / Template</p>
          <p className="mt-2 text-small text-fg-muted">
            Kolom: training_slug, start_date, end_date (YYYY-MM-DD), city, venue, method (online/offline/hybrid), price,
            status (DIBUKA/PENUH/SELESAI).
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <a href="/api/admin/schedules/import-template" download>
              <DownloadIcon aria-hidden />
              Unduh template
            </a>
          </Button>
        </li>
        <li>
          <p className="font-mono text-label uppercase text-fg-muted">02 / Unggah</p>
          <p className="mt-2 text-small text-fg-muted">CSV koma atau titik koma (Excel), maksimal 1.000 baris / 1 MB.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
              File CSV jadwal
            </label>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
            <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              {check.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <FileUpIcon aria-hidden />}
              {file ? "Ganti file" : "Pilih file CSV"}
            </Button>
            {file ? <span className="truncate text-small text-fg-muted">{file.name}</span> : null}
          </div>
        </li>
        <li>
          <p className="font-mono text-label uppercase text-fg-muted">03 / Simpan</p>
          <p className="mt-2 text-small text-fg-muted">
            Tombol simpan aktif kalau semua baris valid. Ada satu baris salah = tidak ada yang disimpan.
          </p>
        </li>
      </ol>

      {error ? (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-md border border-border px-4 py-3">
          <p className="text-small text-status-error">{error}</p>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcwIcon aria-hidden />
            Ulangi
          </Button>
        </div>
      ) : null}

      {preview ? (
        <section aria-labelledby="import-preview-title" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="import-preview-title" className="text-lg font-medium text-fg-strong">
                Pratinjau
              </h2>
              <p className="text-small text-fg-muted" aria-live="polite">
                {preview.rows.length} baris · {preview.validCount} valid ·{" "}
                <span className={preview.invalidCount > 0 ? "text-status-error" : undefined}>
                  {preview.invalidCount} bermasalah
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={reset} disabled={busy}>
                Batal
              </Button>
              <Button
                disabled={busy || preview.invalidCount > 0 || !file}
                aria-busy={commit.isPending}
                onClick={() => file && commit.mutate(file.csv)}
              >
                {commit.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon aria-hidden />}
                Simpan {preview.validCount} jadwal
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16">Baris</TableHead>
                <TableHead>Pelatihan</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Kota / metode</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.map((row) => (
                <TableRow key={row.line} className={cn(row.errors.length > 0 && "align-top")}>
                  <TableCell className="font-mono text-xs">{row.line}</TableCell>
                  <TableCell>
                    <p className="line-clamp-2 max-w-sm">{row.data?.trainingTitle ?? row.values.training_slug}</p>
                    {row.errors.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-small text-status-error">
                        {row.errors.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-small">
                    {row.data ? formatDateRange(row.data.startDate, row.data.endDate) : `${row.values.start_date} – ${row.values.end_date}`}
                  </TableCell>
                  <TableCell className="text-small">
                    {row.data ? `${row.data.city ?? "-"} · ${METHOD_LABELS[row.data.method]}` : `${row.values.city || "-"} · ${row.values.method}`}
                  </TableCell>
                  <TableCell className="font-mono text-small">
                    {row.data ? (row.data.price === null ? "-" : formatRupiah(row.data.price)) : row.values.price || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs uppercase">
                    {row.data ? SCHEDULE_STATUS_LABELS[row.data.status] : row.values.status || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : !error && !check.isPending ? (
        <p className="text-small text-fg-muted">
          Belum ada file. Lihat juga <Link href="/admin/schedules" className="underline underline-offset-2">daftar jadwal</Link>.
        </p>
      ) : null}
    </div>
  );
}
