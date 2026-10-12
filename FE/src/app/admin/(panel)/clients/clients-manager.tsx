"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusinessIcon, ExternalLinkIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createDataTableColumns, type DataTableColumn } from "@/components/admin/data-table";
import { DialogResourceManager } from "@/components/admin/dialog-resource-manager";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormField } from "@/components/admin/form-field";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { Input } from "@/components/admin/ui/input";
import { useScopedId } from "@/hooks/use-scoped-id";
import { resourceKeys } from "@/lib/admin-resources";
import { apiSend, errorMessage } from "@/lib/api/client";
import type { Client } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { applyFieldErrors } from "@/lib/form-errors";

const keys = resourceKeys("clients");
const columnHelper = createDataTableColumns<Client>();

const columns: DataTableColumn<Client>[] = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Klien",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative h-8 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-bg-subtle">
          {row.original.logo ? <MediaThumbnail media={row.original.logo} sizes="80px" fit="contain" /> : null}
        </span>
        <span className="truncate font-medium text-fg-strong">{row.original.name}</span>
      </div>
    ),
  }),
  columnHelper.accessor("url", {
    header: "Tautan",
    cell: ({ getValue }) => {
      const url = getValue();
      return url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-56 items-center gap-1 truncate font-mono text-xs text-fg-muted underline-offset-4 hover:underline"
        >
          <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
          <ExternalLinkIcon className="size-3 shrink-0" aria-hidden />
          <span className="sr-only">(tab baru)</span>
        </a>
      ) : (
        <span className="text-fg-muted">-</span>
      );
    },
  }),
  columnHelper.accessor("updatedAt", {
    header: "Diperbarui",
    cell: ({ getValue }) => <span className="text-small text-fg-muted">{formatDateTime(getValue())}</span>,
  }),
]);

const SORTS = [
  { value: "order", label: "Urutan" },
  { value: "name", label: "Nama A-Z" },
  { value: "-updatedAt", label: "Terakhir diubah" },
] as const;

const rowLabel = (row: Client) => row.name;

export function ClientsManager() {
  return (
    <DialogResourceManager<Client>
      resource="clients"
      title="Klien"
      description="Logo klien tampil grayscale di beranda. Urutan di sini dipakai di situs."
      noun="klien"
      nounTitle="Klien"
      icon={BriefcaseBusinessIcon}
      columns={columns}
      rowLabel={rowLabel}
      sorts={SORTS}
      searchPlaceholder="Cari nama klien"
      emptyDescription="Tambahkan logo instansi yang pernah memakai layanan Anda."
      deleteDescription="Klien dipindahkan ke Sampah dan hilang dari situs. Bisa dipulihkan dalam 30 hari."
      renderDialog={({ item, onClose }) => <ClientDialog client={item} onClose={onClose} />}
    />
  );
}

const schema = z.object({
  name: z.string().trim().min(1, { error: "Nama wajib diisi." }).max(120, { error: "Nama maksimal 120 karakter." }),
  url: z
    .string()
    .trim()
    .max(500, { error: "URL maksimal 500 karakter." })
    .regex(/^(https?:\/\/\S+)?$/, { error: "URL harus diawali http:// atau https://." }),
  logoId: z.string().nullable(),
});
type FormValues = z.infer<typeof schema>;
const FIELD_NAMES = Object.keys(schema.shape);

function ClientDialog({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const id = useScopedId("client");
  const formId = id("form");
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: client?.name ?? "", url: client?.url ?? "", logoId: client?.logoId ?? null },
  });
  const errors = form.formState.errors;

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = { ...values, url: values.url || null };
      return client
        ? apiSend<Client>(`/admin/clients/${client.id}`, "PATCH", body)
        : apiSend<Client>("/admin/clients", "POST", body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success(client ? "Klien disimpan." : "Klien ditambahkan.");
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
    },
  });

  return (
    <FormDialog
      title={client ? "Ubah klien" : "Tambah klien"}
      formId={formId}
      dirty={form.formState.isDirty}
      pending={save.isPending}
      onClose={onClose}
    >
      <form id={formId} noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <FormField id={id("name")} label="Nama" required error={errors.name?.message}>
          <Input {...form.register("name")} autoFocus />
        </FormField>
        <FormField id={id("url")} label="Tautan situs" description="Opsional, mis. https://contoh.co.id." error={errors.url?.message}>
          <Input {...form.register("url")} inputMode="url" placeholder="https://" />
        </FormField>
        <Controller
          control={form.control}
          name="logoId"
          render={({ field, fieldState }) => (
            <FormField
              id={id("logo")}
              label="Logo"
              description="SVG atau PNG transparan. Alt boleh kosong: nama klien dipakai sebagai alt."
              error={fieldState.error?.message}
            >
              <MediaPicker
                altRequired={false}
                value={field.value}
                onChange={field.onChange}
                initialMedia={client?.logo}
                aspect="3/1"
                fit="contain"
                dialogTitle="Pilih logo klien"
              />
            </FormField>
          )}
        />
      </form>
    </FormDialog>
  );
}
