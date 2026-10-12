"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, MegaphoneIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createDataTableColumns, type DataTableColumn } from "@/components/admin/data-table";
import { DialogResourceManager } from "@/components/admin/dialog-resource-manager";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormField } from "@/components/admin/form-field";
import { Input } from "@/components/admin/ui/input";
import { useScopedId } from "@/hooks/use-scoped-id";
import { resourceKeys } from "@/lib/admin-resources";
import { apiSend, errorMessage } from "@/lib/api/client";
import type { MediaPartner } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { applyFieldErrors } from "@/lib/form-errors";

const keys = resourceKeys("media-partners");
const columnHelper = createDataTableColumns<MediaPartner>();

const columns: DataTableColumn<MediaPartner>[] = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Nama",
    cell: ({ getValue }) => <span className="font-medium text-fg-strong">{getValue()}</span>,
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
          className="inline-flex max-w-64 items-center gap-1 truncate font-mono text-xs text-fg-muted underline-offset-4 hover:underline"
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

const rowLabel = (row: MediaPartner) => row.name;

export function MediaPartnersManager() {
  return (
    <DialogResourceManager<MediaPartner>
      resource="media-partners"
      title="Media partner"
      description="Tautan media partner di footer. Urutan di sini dipakai di situs."
      noun="media partner"
      nounTitle="Media partner"
      icon={MegaphoneIcon}
      columns={columns}
      rowLabel={rowLabel}
      sorts={SORTS}
      searchPlaceholder="Cari nama"
      emptyDescription="Tambahkan media yang bekerja sama dengan Anda."
      deleteDescription="Media partner dipindahkan ke Sampah dan hilang dari footer. Bisa dipulihkan dalam 30 hari."
      renderDialog={({ item, onClose }) => <MediaPartnerDialog partner={item} onClose={onClose} />}
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
});
type FormValues = z.infer<typeof schema>;
const FIELD_NAMES = Object.keys(schema.shape);

function MediaPartnerDialog({ partner, onClose }: { partner: MediaPartner | null; onClose: () => void }) {
  const id = useScopedId("media-partner");
  const formId = id("form");
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: partner?.name ?? "", url: partner?.url ?? "" },
  });
  const errors = form.formState.errors;

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = { name: values.name, url: values.url || null };
      return partner
        ? apiSend<MediaPartner>(`/admin/media-partners/${partner.id}`, "PATCH", body)
        : apiSend<MediaPartner>("/admin/media-partners", "POST", body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success(partner ? "Media partner disimpan." : "Media partner ditambahkan.");
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
    },
  });

  return (
    <FormDialog
      title={partner ? "Ubah media partner" : "Tambah media partner"}
      formId={formId}
      dirty={form.formState.isDirty}
      pending={save.isPending}
      onClose={onClose}
    >
      <form id={formId} noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <FormField id={id("name")} label="Nama" required error={errors.name?.message}>
          <Input {...form.register("name")} autoFocus />
        </FormField>
        <FormField id={id("url")} label="Tautan" description="Opsional, mis. https://media.co.id." error={errors.url?.message}>
          <Input {...form.register("url")} inputMode="url" placeholder="https://" />
        </FormField>
      </form>
    </FormDialog>
  );
}
