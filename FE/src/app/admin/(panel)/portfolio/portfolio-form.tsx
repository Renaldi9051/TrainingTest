"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { GalleryEditor } from "@/components/admin/media/gallery-editor";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import { useDeleteWithUndo } from "@/hooks/use-delete-with-undo";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useScopedId } from "@/hooks/use-scoped-id";
import { resourceKeys } from "@/lib/admin-resources";
import { apiSend, errorMessage } from "@/lib/api/client";
import type { PortfolioActivityType, PortfolioItem } from "@/lib/api/types";
import { ACTIVITY_TYPE_LABELS } from "@/lib/labels";
import { applyFieldErrors } from "@/lib/form-errors";

export const portfolioKeys = resourceKeys("portfolio");

// Sama dengan BE (PORTFOLIO_IMAGES_MAX).
const IMAGES_MAX = 30;

const NO_TYPE = "none";

const schema = z.object({
  title: z.string().trim().min(1, { error: "Judul wajib diisi." }).max(200, { error: "Judul maksimal 200 karakter." }),
  activityType: z.string(),
  date: z.string(),
  client: z.string().trim().max(120, { error: "Klien maksimal 120 karakter." }),
  description: z.string().trim().max(1000, { error: "Deskripsi maksimal 1000 karakter." }),
  imageIds: z.array(z.string()).max(IMAGES_MAX, { error: `Galeri maksimal ${IMAGES_MAX} gambar.` }),
});
type FormValues = z.infer<typeof schema>;
const FIELD_NAMES = Object.keys(schema.shape);

function toFormValues(item: PortfolioItem | null): FormValues {
  return {
    title: item?.title ?? "",
    activityType: item?.activityType ?? NO_TYPE,
    date: item?.date ?? "",
    client: item?.client ?? "",
    description: item?.description ?? "",
    imageIds: item?.imageIds ?? [],
  };
}

export function PortfolioForm({ item }: { item: PortfolioItem | null }) {
  const id = useScopedId("portfolio");
  const formId = id("form");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(item), mode: "onBlur" });
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);
  const errors = form.formState.errors;

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        title: values.title,
        activityType: values.activityType === NO_TYPE ? null : (values.activityType as PortfolioActivityType),
        date: values.date || null,
        client: values.client || null,
        description: values.description || null,
        imageIds: values.imageIds,
      };
      return item
        ? (await apiSend<PortfolioItem>(`/admin/portfolio/${item.id}`, "PATCH", body)).data
        : (await apiSend<PortfolioItem>("/admin/portfolio", "POST", body)).data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: portfolioKeys.all });
      queryClient.setQueryData(portfolioKeys.detail(saved.id), saved);
      form.reset(toFormValues(saved));
      toast.success(item ? "Portofolio disimpan." : "Portofolio ditambahkan.");
      if (!item) router.push(`/admin/portfolio/${saved.id}`);
    },
    onError: (error) => {
      // imageIds.N dipasang ke baris galeri yang sesuai.
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
    },
  });

  const remove = useDeleteWithUndo({
    basePath: "/admin/portfolio",
    invalidateKey: portfolioKeys.all,
    noun: "Portofolio",
    onDeleted: () => {
      if (item) queryClient.removeQueries({ queryKey: portfolioKeys.detail(item.id) });
      form.reset();
      router.push("/admin/portfolio");
    },
  });

  const imageErrors = errors.imageIds;
  const itemErrors = Array.isArray(imageErrors)
    ? Array.from({ length: imageErrors.length }, (_, index) => imageErrors[index]?.message)
    : [];

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 space-y-6">
          <FormField id={id("title")} label="Judul" required error={errors.title?.message}>
            <Input {...form.register("title")} />
          </FormField>
          <FormField id={id("description")} label="Deskripsi" error={errors.description?.message}>
            <Textarea rows={4} {...form.register("description")} />
          </FormField>
          <fieldset className="space-y-3 border-t border-border pt-6">
            <legend className="sr-only">Galeri</legend>
            <div>
              <h2 className="text-sm font-medium">Galeri</h2>
              <p className="mt-1 text-small text-fg-muted">
                Urutan di sini dipakai di situs. Setiap gambar wajib punya alt text.
              </p>
              {imageErrors?.message ?? imageErrors?.root?.message ? (
                <p role="alert" className="mt-1 text-small text-status-error">
                  {imageErrors?.message ?? imageErrors?.root?.message}
                </p>
              ) : null}
            </div>
            <Controller
              control={form.control}
              name="imageIds"
              render={({ field }) => (
                <GalleryEditor
                  value={field.value}
                  onChange={(ids) => {
                    // Error per index dari simpan sebelumnya tidak berlaku lagi setelah urutan berubah.
                    form.clearErrors("imageIds");
                    field.onChange(ids);
                  }}
                  initialMedia={item?.images}
                  itemErrors={itemErrors}
                  max={IMAGES_MAX}
                />
              )}
            />
          </fieldset>
        </div>

        <aside className="space-y-6 lg:border-l lg:border-border lg:pl-8">
          <Controller
            control={form.control}
            name="activityType"
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor={id("activity-type")}>Jenis kegiatan</Label>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={id("activity-type")} className="w-full" aria-describedby={id("activity-type-help")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TYPE}>Belum diatur</SelectItem>
                    {(Object.entries(ACTIVITY_TYPE_LABELS) as [PortfolioActivityType, string][]).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id={id("activity-type-help")} className="text-small text-fg-muted">
                  Dipakai filter di halaman Portofolio. Belum diatur = hanya tampil di Semua.
                </p>
              </div>
            )}
          />
          <FormField id={id("date")} label="Tanggal kegiatan" error={errors.date?.message}>
            <Input type="date" {...form.register("date")} />
          </FormField>
          <FormField id={id("client")} label="Klien" description="Nama instansi, opsional." error={errors.client?.message}>
            <Input {...form.register("client")} />
          </FormField>
          {item ? (
            <section className="border-t border-border pt-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-status-error"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon aria-hidden />
                Hapus portofolio
              </Button>
            </section>
          ) : null}
        </aside>
      </form>

      <StickySaveBar formId={formId} dirty={dirty} pending={save.isPending} onReset={() => form.reset()} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus portofolio "${item?.title ?? ""}"?`}
        description="Portofolio dipindahkan ke Sampah dan hilang dari situs. Gambar tetap ada di media library."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          item && remove.mutate({ id: item.id, label: item.title }, { onSettled: () => setConfirmDelete(false) })
        }
      />
    </>
  );
}
