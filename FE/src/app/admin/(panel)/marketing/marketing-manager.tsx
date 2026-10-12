"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PhoneIcon } from "lucide-react";
import { useState } from "react";
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
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { useScopedId } from "@/hooks/use-scoped-id";
import { resourceKeys } from "@/lib/admin-resources";
import { apiSend, errorMessage } from "@/lib/api/client";
import type { MarketingContact } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";
import { cn } from "@/lib/utils";

const keys = resourceKeys("marketing");
const columnHelper = createDataTableColumns<MarketingContact>();

// "6281234567890" -> "+62 812-3456-7890" untuk tampilan admin.
function formatPhone(phone: string): string {
  const match = /^62(\d{3})(\d{4})(\d+)$/.exec(phone);
  return match ? `+62 ${match[1]}-${match[2]}-${match[3]}` : `+${phone}`;
}

const columns: DataTableColumn<MarketingContact>[] = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Nama",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border bg-bg-subtle">
          {row.original.photo ? <MediaThumbnail media={row.original.photo} sizes="36px" /> : null}
        </span>
        <span className="truncate font-medium text-fg-strong">{row.original.name}</span>
      </div>
    ),
  }),
  columnHelper.accessor("phone", {
    header: "WhatsApp",
    cell: ({ getValue }) => <span className="font-mono text-xs">{formatPhone(getValue())}</span>,
  }),
  columnHelper.accessor("active", {
    header: "Status",
    cell: ({ getValue }) => (
      <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase">
        <span aria-hidden className={cn("size-1.5 rounded-full", getValue() ? "bg-status-success" : "bg-fg-subtle")} />
        {getValue() ? "Aktif" : "Nonaktif"}
      </span>
    ),
  }),
]);

const SORTS = [
  { value: "order", label: "Urutan" },
  { value: "name", label: "Nama A-Z" },
  { value: "-updatedAt", label: "Terakhir diubah" },
] as const;

const ALL = "all";
const rowLabel = (row: MarketingContact) => row.name;

export function MarketingManager() {
  const [active, setActive] = useState(ALL);
  return (
    <DialogResourceManager<MarketingContact>
      resource="marketing"
      title="Kontak marketing"
      description="Daftar marketing di panel kontak melayang dan halaman kontak. Hanya yang aktif tampil di situs."
      noun="kontak marketing"
      nounTitle="Kontak marketing"
      icon={PhoneIcon}
      columns={columns}
      rowLabel={rowLabel}
      sorts={SORTS}
      searchPlaceholder="Cari nama atau nomor"
      emptyDescription="Tambahkan marketing yang bisa dihubungi pengunjung lewat WhatsApp."
      deleteDescription="Kontak dipindahkan ke Sampah dan hilang dari situs. Bisa dipulihkan dalam 30 hari."
      params={active === ALL ? undefined : { active }}
      filters={
        <Select value={active} onValueChange={setActive}>
          <SelectTrigger className="w-36" aria-label="Filter status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua status</SelectItem>
            <SelectItem value="true">Aktif</SelectItem>
            <SelectItem value="false">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      }
      renderDialog={({ item, onClose }) => <MarketingDialog contact={item} onClose={onClose} />}
    />
  );
}

const schema = z.object({
  name: z.string().trim().min(1, { error: "Nama wajib diisi." }).max(120, { error: "Nama maksimal 120 karakter." }),
  phone: z
    .string()
    .trim()
    .min(1, { error: "Nomor WhatsApp wajib diisi." })
    .max(30, { error: "Nomor WhatsApp maksimal 30 karakter." })
    .regex(/^[+\d][\d\s().-]*$/, { error: "Nomor WhatsApp hanya boleh berisi angka, spasi, +, -, dan tanda kurung." }),
  defaultMessage: z.string().trim().max(300, { error: "Pesan default maksimal 300 karakter." }),
  active: z.boolean(),
  photoId: z.string().nullable(),
});
type FormValues = z.infer<typeof schema>;
const FIELD_NAMES = Object.keys(schema.shape);

function MarketingDialog({ contact, onClose }: { contact: MarketingContact | null; onClose: () => void }) {
  const id = useScopedId("marketing");
  const formId = id("form");
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: contact?.name ?? "",
      phone: contact ? formatPhone(contact.phone) : "",
      defaultMessage: contact?.defaultMessage ?? "",
      active: contact?.active ?? true,
      photoId: contact?.photoId ?? null,
    },
  });
  const errors = form.formState.errors;

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = { ...values, defaultMessage: values.defaultMessage || null };
      return contact
        ? apiSend<MarketingContact>(`/admin/marketing/${contact.id}`, "PATCH", body)
        : apiSend<MarketingContact>("/admin/marketing", "POST", body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success(contact ? "Kontak marketing disimpan." : "Kontak marketing ditambahkan.");
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
    },
  });

  return (
    <FormDialog
      title={contact ? "Ubah kontak marketing" : "Tambah kontak marketing"}
      formId={formId}
      dirty={form.formState.isDirty}
      pending={save.isPending}
      onClose={onClose}
      className="sm:max-w-xl"
    >
      <form id={formId} noValidate className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <FormField id={id("name")} label="Nama" required error={errors.name?.message}>
          <Input {...form.register("name")} autoFocus />
        </FormField>
        <FormField
          id={id("phone")}
          label="Nomor WhatsApp"
          required
          description="Mis. 0812 3456 7890 atau +62 812 3456 7890."
          error={errors.phone?.message}
        >
          <Input {...form.register("phone")} inputMode="tel" autoComplete="off" />
        </FormField>
        <FormField
          id={id("message")}
          label="Pesan default"
          description="Teks awal saat pengunjung membuka chat WhatsApp. Opsional."
          error={errors.defaultMessage?.message}
        >
          <Textarea rows={3} {...form.register("defaultMessage")} />
        </FormField>
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <div className="flex items-start gap-3">
              <Switch
                id={id("active")}
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-describedby={id("active-help")}
              />
              <div>
                <Label htmlFor={id("active")}>Aktif</Label>
                <p id={id("active-help")} className="mt-1 text-small text-fg-muted">
                  Kontak nonaktif tidak tampil di situs.
                </p>
              </div>
            </div>
          )}
        />
        <Controller
          control={form.control}
          name="photoId"
          render={({ field, fieldState }) => (
            <FormField
              id={id("photo")}
              label="Foto"
              description="Opsional, rasio 1:1, tampil grayscale. Alt boleh kosong: nama dipakai sebagai alt."
              error={fieldState.error?.message}
            >
              <MediaPicker
                altRequired={false}
                value={field.value}
                onChange={field.onChange}
                initialMedia={contact?.photo}
                aspect="1/1"
                dialogTitle="Pilih foto marketing"
              />
            </FormField>
          )}
        />
      </form>
    </FormDialog>
  );
}
