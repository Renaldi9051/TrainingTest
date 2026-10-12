"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { IconPicker } from "@/components/admin/icon-picker";
import { SlugField } from "@/components/admin/slug-field";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useScopedId } from "@/hooks/use-scoped-id";
import { ApiError, apiSend, errorMessage } from "@/lib/api/client";
import type { Category, CategoryInUseDetails } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";

export const categoryKeys = {
  all: ["admin", "categories"] as const,
  list: (params: object) => ["admin", "categories", "list", params] as const,
  detail: (id: string) => ["admin", "categories", "detail", id] as const,
  options: ["admin", "categories", "options"] as const,
};

const schema = z.object({
  name: z.string().trim().min(1, { error: "Nama wajib diisi." }).max(100, { error: "Nama maksimal 100 karakter." }),
  slug: z.string().trim().max(120, { error: "Slug maksimal 120 karakter." }),
  description: z.string().trim().max(1000, { error: "Deskripsi maksimal 1000 karakter." }),
  icon: z.string().nullable(),
  featured: z.boolean(),
});
type FormValues = z.infer<typeof schema>;


export function CategoryForm({ category }: { category: Category | null }) {
  const sid = useScopedId("category");
  const formId = sid("form");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [autoSlug, setAutoSlug] = useState(category === null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? null,
      featured: category?.featured ?? false,
    },
    mode: "onBlur",
  });
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      // Slug otomatis (belum diedit manual) tidak dikirim: BE membuat slug unik sendiri.
      const slug = autoSlug && !category ? undefined : values.slug || undefined;
      const body = { ...values, description: values.description || null, slug };
      return category
        ? (await apiSend<Category>(`/admin/categories/${category.id}`, "PATCH", body)).data
        : (await apiSend<Category>("/admin/categories", "POST", body)).data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.setQueryData(categoryKeys.detail(saved.id), saved);
      form.reset({
        name: saved.name,
        slug: saved.slug,
        description: saved.description ?? "",
        icon: saved.icon,
        featured: saved.featured,
      });
      setAutoSlug(false);
      toast.success(category ? "Kategori disimpan." : "Kategori ditambahkan.");
      if (!category) router.push(`/admin/categories/${saved.id}`);
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, ["name", "slug", "description", "icon", "featured"])) {
        toast.error(errorMessage(error));
      }
    },
  });

  const remove = useMutation({
    mutationFn: async () => apiSend(`/admin/categories/${category?.id}`, "DELETE"),
    onSuccess: async () => {
      // Detail item yang dihapus dibuang dulu supaya tidak di-refetch (404).
      if (category) queryClient.removeQueries({ queryKey: categoryKeys.detail(category.id) });
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      form.reset();
      toast.success("Kategori dipindahkan ke Sampah.");
      router.push("/admin/categories");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "CATEGORY_IN_USE") {
        const count = (error.details as CategoryInUseDetails | undefined)?.trainingCount ?? 0;
        toast.error(`Kategori masih dipakai ${count} pelatihan. Pindahkan dulu lewat aksi massal di daftar pelatihan.`);
      } else {
        toast.error(errorMessage(error));
      }
      setConfirmDelete(false);
    },
  });

  const errors = form.formState.errors;
  const name = useWatch({ control: form.control, name: "name" });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="space-y-6">
          <FormField id={sid("name")} label="Nama" required error={errors.name?.message}>
            <Input {...form.register("name")} />
          </FormField>
          <Controller
            control={form.control}
            name="slug"
            render={({ field }) => (
              <SlugField
                id={sid("slug")}
                entity="category"
                value={field.value}
                onChange={field.onChange}
                source={name}
                auto={autoSlug}
                onAutoChange={setAutoSlug}
                excludeId={category?.id}
                prefix="/pelatihan/kategori/"
                error={errors.slug?.message}
                publishedSlug={category?.slug}
              />
            )}
          />
          <FormField
            id={sid("description")}
            label="Deskripsi"
            description="Tampil di halaman kategori publik."
            error={errors.description?.message}
          >
            <Textarea rows={5} {...form.register("description")} />
          </FormField>
        </div>

        <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
          <Controller
            control={form.control}
            name="featured"
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor={sid("featured")}>Unggulan</Label>
                  <p id={sid("featured-help")} className="mt-1 text-small text-fg-muted">
                    Tampil sebagai kategori populer.
                  </p>
                </div>
                <Switch
                  id={sid("featured")}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-describedby={sid("featured-help")}
                />
              </div>
            )}
          />
          <Controller
            control={form.control}
            name="icon"
            render={({ field }) => (
              <IconPicker name={sid("icon")} value={field.value} onChange={field.onChange} error={errors.icon?.message} />
            )}
          />
          {category ? (
            <div className="border-t border-border pt-6">
              <p className="text-small text-fg-muted">
                {category.trainingCount > 0
                  ? `Dipakai ${category.trainingCount} pelatihan. Pindahkan pelatihan tersebut sebelum menghapus.`
                  : "Belum dipakai pelatihan mana pun."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 text-status-error"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon aria-hidden />
                Hapus kategori
              </Button>
            </div>
          ) : null}
        </aside>
      </form>

      <StickySaveBar formId={formId} dirty={dirty} pending={save.isPending} onReset={() => form.reset()} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus kategori "${category?.name ?? ""}"?`}
        description="Kategori dipindahkan ke Sampah dan hilang dari situs. Bisa dipulihkan dalam 30 hari."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
