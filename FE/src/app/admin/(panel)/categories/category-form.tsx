"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MergeIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { IconPicker } from "@/components/admin/icon-picker";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { SlugField } from "@/components/admin/slug-field";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { TagInput } from "@/components/admin/tag-input";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useScopedId } from "@/hooks/use-scoped-id";
import { ApiError, apiSend, errorMessage } from "@/lib/api/client";
import type { Category, CategoryInUseDetails, CategoryOnlyCategoryDetails } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";
import { formatNumber } from "@/lib/format";
import { trainingKeys } from "../trainings/training-keys";
import { CategoryMergeDialog } from "./category-merge-dialog";

export const categoryKeys = {
  all: ["admin", "categories"] as const,
  list: (params: object) => ["admin", "categories", "list", params] as const,
  detail: (id: string) => ["admin", "categories", "detail", id] as const,
  options: ["admin", "categories", "options"] as const,
  keywordMatches: (id: string) => ["admin", "categories", "keyword-matches", id] as const,
};

// Sama dengan batas BE (validators/category.ts).
export const KEYWORDS_MAX = 20;
const KEYWORD_MAX_LENGTH = 60;

const schema = z.object({
  name: z.string().trim().min(1, { error: "Nama wajib diisi." }).max(100, { error: "Nama maksimal 100 karakter." }),
  slug: z.string().trim().max(120, { error: "Slug maksimal 120 karakter." }),
  description: z.string().trim().max(1000, { error: "Deskripsi maksimal 1000 karakter." }),
  icon: z.string().nullable(),
  featured: z.boolean(),
  imageId: z.string().nullable(),
  keywords: z
    .array(
      z
        .string()
        .min(2, { error: "Kata kunci minimal 2 karakter." })
        .max(KEYWORD_MAX_LENGTH, { error: `Kata kunci maksimal ${KEYWORD_MAX_LENGTH} karakter.` }),
    )
    .max(KEYWORDS_MAX, { error: `Maksimal ${KEYWORDS_MAX} kata kunci.` }),
});
type FormValues = z.infer<typeof schema>;

export function CategoryForm({ category }: { category: Category | null }) {
  const sid = useScopedId("category");
  const formId = sid("form");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [autoSlug, setAutoSlug] = useState(category === null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  // Pelatihan yang hanya punya kategori ini (hapus dengan lepas tautan ditolak BE).
  const [orphans, setOrphans] = useState<CategoryOnlyCategoryDetails | null>(null);
  const inUse = (category?.trainingCount ?? 0) > 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      icon: category?.icon ?? null,
      featured: category?.featured ?? false,
      imageId: category?.imageId ?? null,
      keywords: category?.keywords ?? [],
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
        imageId: saved.imageId,
        keywords: saved.keywords,
      });
      setAutoSlug(false);
      toast.success(category ? "Kategori disimpan." : "Kategori ditambahkan.");
      if (!category) router.push(`/admin/categories/${saved.id}`);
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, ["name", "slug", "description", "icon", "featured", "imageId", "keywords"])) {
        toast.error(errorMessage(error));
      }
    },
  });

  // Kategori yang dipakai pelatihan dihapus dengan ?detach=true: tautan dilepas dulu oleh BE.
  const remove = useMutation({
    mutationFn: async () => apiSend(`/admin/categories/${category?.id}${inUse ? "?detach=true" : ""}`, "DELETE"),
    onSuccess: async () => {
      // Detail item yang dihapus dibuang dulu supaya tidak di-refetch (404).
      if (category) queryClient.removeQueries({ queryKey: categoryKeys.detail(category.id) });
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      if (inUse) await queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      form.reset();
      toast.success("Kategori dipindahkan ke Sampah.");
      router.push("/admin/categories");
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "CATEGORY_ONLY_CATEGORY") {
        // Dialog tetap terbuka dan menampilkan pelatihan yang perlu kategori lain.
        setOrphans((error.details as CategoryOnlyCategoryDetails | undefined) ?? { trainings: [], total: 0 });
        return;
      }
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
  const keywordError = errors.keywords?.message ?? errors.keywords?.find?.((item) => item?.message)?.message;

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
            description="Dipakai sebagai deskripsi halaman kategori untuk mesin pencari."
            error={errors.description?.message}
          >
            <Textarea rows={5} {...form.register("description")} />
          </FormField>
          <Controller
            control={form.control}
            name="keywords"
            render={({ field }) => (
              <FormField
                id={sid("keywords")}
                label="Kata kunci"
                description="Pelatihan yang judulnya memuat salah satu kata ini muncul di daftar Pelatihan yang cocok. Tidak ada yang ditautkan otomatis. Tekan Enter atau koma untuk menambah."
                error={keywordError}
              >
                <TagInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  max={KEYWORDS_MAX}
                  removeLabel={(tag) => `Hapus kata kunci ${tag}`}
                  placeholder={field.value.length >= KEYWORDS_MAX ? `Maksimal ${KEYWORDS_MAX} kata kunci` : "Contoh: drone"}
                />
              </FormField>
            )}
          />
        </div>

        <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
          <p className="text-small text-fg-muted">
            Kategori baru langsung tersedia untuk pelatihan. Untuk menampilkannya di dropdown Pelatihan, tambahkan submenu di <Link href="/admin/navigation" className="underline-offset-4 hover:underline">Navigasi</Link>.
          </p>
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
          <Controller
            control={form.control}
            name="imageId"
            render={({ field, fieldState }) => (
              <FormField
                id={sid("image")}
                label="Gambar"
                description="Wajib punya alt text. Tampil di halaman kategori dan menjadi gambar pelatihan yang belum punya sampul."
                error={fieldState.error?.message}
              >
                <MediaPicker value={field.value} onChange={field.onChange} initialMedia={category?.image} dialogTitle="Pilih gambar kategori" />
              </FormField>
            )}
          />
          {category ? (
            <div className="space-y-3 border-t border-border pt-6">
              <p className="text-small text-fg-muted">
                {inUse ? `Dipakai ${formatNumber(category.trainingCount)} pelatihan.` : "Belum dipakai pelatihan mana pun."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
                  <MergeIcon aria-hidden />
                  Gabungkan ke kategori lain
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-status-error"
                  onClick={() => {
                    setOrphans(null);
                    setConfirmDelete(true);
                  }}
                >
                  <Trash2Icon aria-hidden />
                  Hapus kategori
                </Button>
              </div>
            </div>
          ) : null}
        </aside>
      </form>

      <StickySaveBar formId={formId} dirty={dirty} pending={save.isPending} onReset={() => form.reset()} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus kategori "${category?.name ?? ""}"?`}
        description={
          inUse
            ? `Kategori dilepas dari ${formatNumber(category?.trainingCount ?? 0)} pelatihan lalu dipindahkan ke Sampah. Pelatihan tetap tampil di kategori lainnya. Item menu ke kategori ini ikut dihapus. Kalau kategori dipulihkan, tautan pelatihannya tidak ikut kembali.`
            : "Kategori dipindahkan ke Sampah dan hilang dari situs. Item menu ke kategori ini ikut dihapus. Bisa dipulihkan dalam 30 hari."
        }
        confirmLabel={inUse ? "Lepas dan hapus" : "Hapus"}
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      >
        {orphans ? (
          <div role="alert" className="space-y-2 rounded-md border border-border p-3 text-small">
            <p className="text-status-error">
              {formatNumber(orphans.total)} pelatihan hanya punya kategori ini. Tambahkan kategori lain ke pelatihan berikut dulu, lalu hapus lagi.
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {orphans.trainings.map((training) => (
                <li key={training.id}>
                  <Link href={`/admin/trainings/${training.id}`} className="underline-offset-4 hover:underline">
                    {training.title}
                  </Link>
                </li>
              ))}
            </ul>
            {orphans.total > orphans.trainings.length ? (
              <p className="text-fg-muted">dan {formatNumber(orphans.total - orphans.trainings.length)} pelatihan lainnya.</p>
            ) : null}
          </div>
        ) : null}
      </ConfirmDialog>

      {category ? (
        <CategoryMergeDialog category={category} open={mergeOpen} onOpenChange={setMergeOpen} onMerged={() => form.reset()} />
      ) : null}
    </>
  );
}
