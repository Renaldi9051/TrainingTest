"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareQuoteIcon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { createDataTableColumns, type DataTableColumn } from "@/components/admin/data-table";
import { DialogResourceManager } from "@/components/admin/dialog-resource-manager";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormField } from "@/components/admin/form-field";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { Input } from "@/components/admin/ui/input";
import { Textarea } from "@/components/admin/ui/textarea";
import { useScopedId } from "@/hooks/use-scoped-id";
import { resourceKeys } from "@/lib/admin-resources";
import { apiSend, errorMessage } from "@/lib/api/client";
import type { Testimonial } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";

const keys = resourceKeys("testimonials");
// Sama dengan BE (QUOTE_MAX).
const QUOTE_MAX = 600;
const columnHelper = createDataTableColumns<Testimonial>();

const columns: DataTableColumn<Testimonial>[] = columnHelper.columns([
  columnHelper.accessor("name", {
    header: "Nama",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-border bg-bg-subtle">
          {row.original.photo ? <MediaThumbnail media={row.original.photo} sizes="36px" /> : null}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-fg-strong">{row.original.name}</p>
          <p className="truncate text-small text-fg-muted">
            {[row.original.role, row.original.company].filter(Boolean).join(", ") || "-"}
          </p>
        </div>
      </div>
    ),
  }),
  columnHelper.accessor("quote", {
    header: "Testimoni",
    cell: ({ getValue }) => <p className="line-clamp-2 max-w-md text-small text-fg-muted">{getValue()}</p>,
  }),
]);

const SORTS = [
  { value: "order", label: "Urutan" },
  { value: "name", label: "Nama A-Z" },
  { value: "-updatedAt", label: "Terakhir diubah" },
] as const;

const rowLabel = (row: Testimonial) => row.name;

export function TestimonialsManager() {
  return (
    <DialogResourceManager<Testimonial>
      resource="testimonials"
      title="Testimoni"
      description="Kutipan peserta atau klien. Tampil di section Testimoni beranda."
      noun="testimoni"
      nounTitle="Testimoni"
      icon={MessageSquareQuoteIcon}
      columns={columns}
      rowLabel={rowLabel}
      sorts={SORTS}
      searchPlaceholder="Cari nama, instansi, atau isi"
      emptyDescription="Tambahkan kutipan singkat dari peserta pelatihan."
      deleteDescription="Testimoni dipindahkan ke Sampah dan hilang dari situs. Bisa dipulihkan dalam 30 hari."
      renderDialog={({ item, onClose }) => <TestimonialDialog testimonial={item} onClose={onClose} />}
    />
  );
}

const schema = z.object({
  name: z.string().trim().min(1, { error: "Nama wajib diisi." }).max(120, { error: "Nama maksimal 120 karakter." }),
  role: z.string().trim().max(120, { error: "Jabatan maksimal 120 karakter." }),
  company: z.string().trim().max(120, { error: "Instansi maksimal 120 karakter." }),
  quote: z
    .string()
    .trim()
    .min(1, { error: "Testimoni wajib diisi." })
    .max(QUOTE_MAX, { error: `Testimoni maksimal ${QUOTE_MAX} karakter.` }),
  photoId: z.string().nullable(),
});
type FormValues = z.infer<typeof schema>;
const FIELD_NAMES = Object.keys(schema.shape);

function TestimonialDialog({ testimonial, onClose }: { testimonial: Testimonial | null; onClose: () => void }) {
  const id = useScopedId("testimonial");
  const formId = id("form");
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: testimonial?.name ?? "",
      role: testimonial?.role ?? "",
      company: testimonial?.company ?? "",
      quote: testimonial?.quote ?? "",
      photoId: testimonial?.photoId ?? null,
    },
  });
  const errors = form.formState.errors;
  const quote = useWatch({ control: form.control, name: "quote" });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = { ...values, role: values.role || null, company: values.company || null };
      return testimonial
        ? apiSend<Testimonial>(`/admin/testimonials/${testimonial.id}`, "PATCH", body)
        : apiSend<Testimonial>("/admin/testimonials", "POST", body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.all });
      toast.success(testimonial ? "Testimoni disimpan." : "Testimoni ditambahkan.");
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
    },
  });

  return (
    <FormDialog
      title={testimonial ? "Ubah testimoni" : "Tambah testimoni"}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id={id("role")} label="Jabatan" error={errors.role?.message}>
            <Input {...form.register("role")} />
          </FormField>
          <FormField id={id("company")} label="Instansi" error={errors.company?.message}>
            <Input {...form.register("company")} />
          </FormField>
        </div>
        <FormField
          id={id("quote")}
          label="Testimoni"
          required
          description={`${quote.length}/${QUOTE_MAX} karakter.`}
          error={errors.quote?.message}
        >
          <Textarea rows={4} {...form.register("quote")} />
        </FormField>
        <Controller
          control={form.control}
          name="photoId"
          render={({ field, fieldState }) => (
            <FormField
              id={id("photo")}
              label="Foto"
              description="Opsional, rasio 1:1. Alt boleh kosong: nama orang dipakai sebagai alt."
              error={fieldState.error?.message}
            >
              <MediaPicker
                altRequired={false}
                value={field.value}
                onChange={field.onChange}
                initialMedia={testimonial?.photo}
                aspect="1/1"
                dialogTitle="Pilih foto"
              />
            </FormField>
          )}
        />
      </form>
    </FormDialog>
  );
}
