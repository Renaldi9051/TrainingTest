"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDaysIcon, PencilIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  createDataTableColumns,
  DataTable,
  DataTableToolbar,
  type DataTableColumn,
} from "@/components/admin/data-table";
import { FormField } from "@/components/admin/form-field";
import { TrainingPicker } from "@/components/admin/training-picker";
import { Button } from "@/components/admin/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui/dialog";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { PaginationMeta, Schedule, Training } from "@/lib/api/types";
import { formatDateRange, formatRupiah } from "@/lib/format";
import { applyFieldErrors } from "@/lib/form-errors";
import { METHOD_LABELS, SCHEDULE_STATUS_LABELS } from "@/lib/labels";

export const scheduleKeys = {
  all: ["admin", "schedules"] as const,
  list: (params: object) => ["admin", "schedules", "list", params] as const,
};

const ALL = "all";
const EMPTY: Schedule[] = [];

type DialogState = { mode: "create" } | { mode: "edit"; schedule: Schedule };

export function SchedulesList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const trainingId = searchParams.get("trainingId");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const q = useDeferredValue(search.trim());
  const [period, setPeriod] = useState<string>("upcoming");
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState<Schedule | null>(null);

  const training = useQuery({
    queryKey: ["admin", "trainings", "detail", trainingId ?? ""],
    queryFn: async () => (await apiFetch<Training>(`/admin/trainings/${trainingId}`)).data,
    enabled: Boolean(trainingId),
  });

  const params = useMemo(() => ({ q, period, status, page, trainingId }), [q, period, status, page, trainingId]);
  const query = useQuery({
    queryKey: scheduleKeys.list(params),
    queryFn: async () => {
      const search = new URLSearchParams({
        page: String(page),
        pageSize: "20",
        sort: period === "past" ? "-startDate" : "startDate",
      });
      if (q) search.set("q", q);
      if (period !== ALL) search.set("period", period);
      if (status !== ALL) search.set("status", status);
      if (trainingId) search.set("trainingId", trainingId);
      return apiFetch<Schedule[], PaginationMeta>(`/admin/schedules?${search}`);
    },
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: async (schedule: Schedule) => apiSend(`/admin/schedules/${schedule.id}`, "DELETE"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["admin", "trainings"] });
      setDeleting(null);
      toast.success("Jadwal dihapus.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const columnHelper = createDataTableColumns<Schedule>();
  const columns: DataTableColumn<Schedule>[] = columnHelper.columns([
    columnHelper.accessor("startDate", {
      header: "Tanggal",
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{formatDateRange(row.original.startDate, row.original.endDate)}</span>
      ),
    }),
    columnHelper.accessor((row) => row.training.title, {
      id: "training",
      header: "Pelatihan",
      cell: ({ row }) => (
        <Link
          href={`/admin/trainings/${row.original.training.id}`}
          className="line-clamp-2 max-w-md underline-offset-4 hover:underline"
        >
          {row.original.training.title}
        </Link>
      ),
    }),
    columnHelper.accessor("city", {
      header: "Kota / tempat",
      cell: ({ row }) => (
        <div className="text-small">
          <p>{row.original.city ?? <span className="text-fg-muted">-</span>}</p>
          {row.original.venue ? <p className="text-fg-muted">{row.original.venue}</p> : null}
        </div>
      ),
    }),
    columnHelper.accessor("method", {
      header: "Metode",
      cell: ({ getValue }) => METHOD_LABELS[getValue()],
    }),
    columnHelper.accessor("price", {
      header: "Harga",
      cell: ({ getValue }) => {
        const price = getValue();
        return price === null ? <span className="text-fg-muted">-</span> : <span className="font-mono text-small">{formatRupiah(price)}</span>;
      },
    }),
    columnHelper.accessor("displayStatus", {
      header: "Status",
      cell: ({ row }) => (
        <span className="font-mono text-xs uppercase" title={row.original.status !== row.original.displayStatus ? "Otomatis selesai karena tanggal sudah lewat" : undefined}>
          {SCHEDULE_STATUS_LABELS[row.original.displayStatus]}
        </span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Aksi</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Ubah jadwal" onClick={() => setDialog({ mode: "edit", schedule: row.original })}>
            <PencilIcon strokeWidth={1.5} aria-hidden />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Hapus jadwal" onClick={() => setDeleting(row.original)}>
            <Trash2Icon strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
      ),
    }),
  ]);

  const filtered = Boolean(q) || status !== ALL || period !== ALL;

  return (
    <>
      {trainingId ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-border-strong bg-bg-subtle px-3 py-2">
          <p className="text-small">
            Jadwal untuk <span className="font-medium text-fg-strong">{training.data?.title ?? "pelatihan terpilih"}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => router.replace(pathname)}>
            <XIcon aria-hidden />
            Semua pelatihan
          </Button>
        </div>
      ) : null}
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setDialog({ mode: "create" })}>
          <PlusIcon aria-hidden />
          Tambah jadwal
        </Button>
      </div>
      <DataTableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Cari judul pelatihan, kota, atau tempat"
        filters={
          <>
            <Select
              value={period}
              onValueChange={(value) => {
                setPeriod(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40" aria-label="Filter periode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Akan datang</SelectItem>
                <SelectItem value="past">Sudah lewat</SelectItem>
                <SelectItem value={ALL}>Semua</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36" aria-label="Filter status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Semua status</SelectItem>
                {Object.entries(SCHEDULE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
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
        rowLabel={(row) => `${row.training.title} ${row.startDate}`}
        isPending={query.isPending}
        isError={query.isError}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        unit="jadwal"
        empty={{
          icon: CalendarDaysIcon,
          title: filtered ? "Tidak ada jadwal yang cocok" : "Belum ada jadwal",
          description: filtered ? "Ubah kata kunci atau filter." : "Tambah sesi satu per satu atau import dari CSV.",
          action: filtered ? undefined : (
            <Button onClick={() => setDialog({ mode: "create" })}>Tambah jadwal</Button>
          ),
        }}
      />

      {dialog ? (
        <ScheduleDialog
          state={dialog}
          defaultTraining={trainingId && training.data ? { id: trainingId, title: training.data.title } : null}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title="Hapus jadwal ini?"
        description={
          deleting
            ? `${deleting.training.title}, ${formatDateRange(deleting.startDate, deleting.endDate)}. Sesi hilang dari situs dan bisa dipulihkan dalam 30 hari.`
            : undefined
        }
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Pilih tanggal." });

const scheduleSchema = z
  .object({
    trainingId: z.string().min(1, { error: "Pilih pelatihan." }),
    startDate: dateString,
    endDate: dateString,
    city: z.string().trim().max(100, { error: "Kota maksimal 100 karakter." }),
    venue: z.string().trim().max(200, { error: "Tempat maksimal 200 karakter." }),
    method: z.enum(["ONLINE", "OFFLINE", "HYBRID"]),
    price: z
      .string()
      .trim()
      .regex(/^\d*$/, { error: "Harga hanya angka, tanpa titik atau Rp." }),
    status: z.enum(["OPEN", "FULL", "COMPLETED"]),
  })
  .refine((value) => value.endDate >= value.startDate, {
    error: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["endDate"],
  });
type ScheduleFormValues = z.infer<typeof scheduleSchema>;

function ScheduleDialog({
  state,
  defaultTraining,
  onClose,
}: {
  state: DialogState;
  defaultTraining: { id: string; title: string } | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const editing = state.mode === "edit" ? state.schedule : null;
  const [trainingTitle, setTrainingTitle] = useState<string | null>(
    editing?.training.title ?? defaultTraining?.title ?? null,
  );
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      trainingId: editing?.training.id ?? defaultTraining?.id ?? "",
      startDate: editing?.startDate ?? "",
      endDate: editing?.endDate ?? "",
      city: editing?.city ?? "",
      venue: editing?.venue ?? "",
      method: editing?.method ?? "OFFLINE",
      price: editing?.price?.toString() ?? "",
      status: editing?.status ?? "OPEN",
    },
  });
  const errors = form.formState.errors;

  const save = useMutation({
    mutationFn: async (values: ScheduleFormValues) => {
      const body = {
        ...values,
        city: values.city || null,
        venue: values.venue || null,
        price: values.price === "" ? null : Number(values.price),
      };
      return editing
        ? apiSend(`/admin/schedules/${editing.id}`, "PATCH", body)
        : apiSend("/admin/schedules", "POST", body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      await queryClient.invalidateQueries({ queryKey: ["admin", "trainings"] });
      toast.success(editing ? "Jadwal diperbarui." : "Jadwal ditambahkan.");
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, Object.keys(scheduleSchema.shape))) toast.error(errorMessage(error));
    },
  });

  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah jadwal" : "Tambah jadwal"}</DialogTitle>
          <DialogDescription>Tanggal dalam WIB. Harga dalam Rupiah tanpa titik.</DialogDescription>
        </DialogHeader>
        <form id="schedule-form" noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <Controller
            control={form.control}
            name="trainingId"
            render={({ field }) => (
              <FormField id="schedule-training" label="Pelatihan" required error={errors.trainingId?.message}>
                <TrainingPicker
                  value={field.value || null}
                  selectedTitle={trainingTitle}
                  onChange={(selected) => {
                    field.onChange(selected.id);
                    setTrainingTitle(selected.title);
                  }}
                />
              </FormField>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="schedule-start" label="Tanggal mulai" required error={errors.startDate?.message}>
              <Input type="date" {...form.register("startDate")} />
            </FormField>
            <FormField id="schedule-end" label="Tanggal selesai" required error={errors.endDate?.message}>
              <Input type="date" {...form.register("endDate")} />
            </FormField>
            <FormField id="schedule-city" label="Kota" error={errors.city?.message}>
              <Input {...form.register("city")} placeholder="Jakarta" />
            </FormField>
            <FormField id="schedule-venue" label="Tempat" error={errors.venue?.message}>
              <Input {...form.register("venue")} placeholder="Nama hotel / Zoom" />
            </FormField>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="schedule-method">Metode</Label>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="schedule-method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METHOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="schedule-status">Status</Label>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="schedule-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCHEDULE_STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            <FormField
              id="schedule-price"
              label="Harga (Rp)"
              description="Tampil hanya kalau pelatihan menampilkan harga."
              error={errors.price?.message}
              className="sm:col-span-2"
            >
              <Input inputMode="numeric" {...form.register("price")} placeholder="4500000" />
            </FormField>
          </div>
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="schedule-form" disabled={save.isPending} aria-busy={save.isPending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
