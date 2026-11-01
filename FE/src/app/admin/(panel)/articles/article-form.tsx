"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, SeoPanel } from "@/components/admin/seo-panel";
import { SlugField } from "@/components/admin/slug-field";
import { PublicStateLabel } from "@/components/admin/status-dot";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import { useScopedId } from "@/hooks/use-scoped-id";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { Article, ArticleCategory, RichTextDoc } from "@/lib/api/types";
import { fromWibInputValue, toWibInputValue } from "@/lib/format";
import { applyFieldErrors } from "@/lib/form-errors";
import { isRichTextEmpty } from "@/lib/rich-text";
import { ArticleCategoriesDialog } from "./article-categories-dialog";
import { articleKeys, articlePreviewHref } from "./article-keys";

const TITLE_MAX = 200;
const EXCERPT_MAX = 400;

// Tiga pilihan publikasi (referensi atasan: Simpan draf / Jadwalkan / Publish sekarang), dipetakan ke
// status + publishedAt yang sama dengan pelatihan.
const PUBLISH_MODES = [
  { value: "draft", label: "Draf", help: "Disimpan internal, belum tampil di situs." },
  { value: "now", label: "Tayang sekarang", help: "Tampil di situs setelah disimpan." },
  { value: "schedule", label: "Jadwalkan", help: "Tampil otomatis pada waktu yang dipilih (WIB)." },
] as const;
type PublishMode = (typeof PUBLISH_MODES)[number]["value"];

const richText = z.custom<RichTextDoc | null>((value) => value === null || typeof value === "object");

const schema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: "Judul wajib diisi." })
      .max(TITLE_MAX, { error: `Judul maksimal ${TITLE_MAX} karakter.` }),
    slug: z.string().trim().max(120, { error: "Slug maksimal 120 karakter." }),
    authorName: z
      .string()
      .trim()
      .min(1, { error: "Penulis wajib diisi." })
      .max(120, { error: "Penulis maksimal 120 karakter." }),
    sourceName: z.string().trim().max(160, { error: "Nama sumber maksimal 160 karakter." }),
    sourceUrl: z
      .string()
      .trim()
      .max(500, { error: "URL maksimal 500 karakter." })
      .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), {
        error: "URL harus diawali http:// atau https://.",
      }),
    categoryId: z.string().min(1, { error: "Pilih kategori." }),
    excerpt: z.string().trim().max(EXCERPT_MAX, { error: `Ringkasan maksimal ${EXCERPT_MAX} karakter.` }),
    body: richText,
    coverId: z.string().nullable(),
    publishMode: z.enum(["draft", "now", "schedule"]),
    publishedAt: z.string(),
    seo: z.object({
      title: z.string().trim().max(SEO_TITLE_MAX, { error: `Judul SEO maksimal ${SEO_TITLE_MAX} karakter.` }),
      description: z
        .string()
        .trim()
        .max(SEO_DESCRIPTION_MAX, { error: `Deskripsi SEO maksimal ${SEO_DESCRIPTION_MAX} karakter.` }),
      ogImageId: z.string().nullable(),
    }),
  })
  // Sama dengan BE: isi wajib saat tayang/terjadwal.
  .refine((value) => value.publishMode === "draft" || !isRichTextEmpty(value.body), {
    error: "Isi artikel wajib diisi sebelum ditayangkan.",
    path: ["body"],
  })
  .refine((value) => value.publishMode !== "schedule" || value.publishedAt !== "", {
    error: "Pilih waktu tayang.",
    path: ["publishedAt"],
  })
  .refine(
    (value) =>
      value.publishMode !== "schedule" ||
      value.publishedAt === "" ||
      new Date(fromWibInputValue(value.publishedAt) ?? "").getTime() > Date.now(),
    { error: "Waktu jadwal harus di masa depan. Pilih Tayang sekarang untuk menayangkan langsung.", path: ["publishedAt"] },
  );
type FormValues = z.infer<typeof schema>;

const FIELD_NAMES = Object.keys(schema.shape) as (keyof FormValues)[];

function toPublishMode(article: Article | null): PublishMode {
  if (!article || article.publicState === "DRAFT") return "draft";
  return article.publicState === "SCHEDULED" ? "schedule" : "now";
}

function toFormValues(article: Article | null): FormValues {
  return {
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    authorName: article?.authorName ?? "",
    sourceName: article?.sourceName ?? "",
    sourceUrl: article?.sourceUrl ?? "",
    categoryId: article?.categoryId ?? "",
    excerpt: article?.excerpt ?? "",
    body: article?.body ?? null,
    coverId: article?.coverId ?? null,
    publishMode: toPublishMode(article),
    publishedAt: article?.publicState === "SCHEDULED" ? toWibInputValue(article.publishedAt) : "",
    seo: article?.seo ?? { title: "", description: "", ogImageId: null },
  };
}

// autoSlug: slug masih mengikuti judul, jadi tidak dikirim; BE membuat slug unik sendiri.
function toBody(values: FormValues, article: Article | null, autoSlug: boolean) {
  const publish =
    values.publishMode === "draft"
      ? { status: "DRAFT" as const, publishedAt: null }
      : values.publishMode === "schedule"
        ? { status: "PUBLISHED" as const, publishedAt: fromWibInputValue(values.publishedAt) }
        : // Sudah tayang: waktu tayang lama dipertahankan (edit tidak membuat artikel tampak "baru").
          { status: "PUBLISHED" as const, publishedAt: article?.publicState === "PUBLISHED" ? article.publishedAt : null };
  return {
    title: values.title,
    slug: autoSlug ? undefined : values.slug || undefined,
    authorName: values.authorName,
    sourceName: values.sourceName || null,
    sourceUrl: values.sourceUrl || null,
    categoryId: values.categoryId,
    excerpt: values.excerpt || null,
    body: values.body,
    coverId: values.coverId,
    seo: values.seo,
    ...publish,
  };
}

const SAVED_MESSAGE: Record<Article["publicState"], string> = {
  DRAFT: "Artikel disimpan sebagai draf.",
  SCHEDULED: "Artikel dijadwalkan tayang.",
  PUBLISHED: "Artikel tayang. Situs diperbarui dalam beberapa detik.",
};

export function ArticleForm({ article }: { article: Article | null }) {
  const sid = useScopedId("article");
  const formId = sid("form");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [autoSlug, setAutoSlug] = useState(article === null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(article),
    mode: "onBlur",
  });
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);
  const errors = form.formState.errors;
  const title = useWatch({ control: form.control, name: "title" });
  const excerpt = useWatch({ control: form.control, name: "excerpt" });
  const publishMode = useWatch({ control: form.control, name: "publishMode" });

  const categories = useQuery({
    queryKey: articleKeys.categories,
    queryFn: async () => (await apiFetch<ArticleCategory[]>("/admin/article-categories")).data,
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = toBody(values, article, autoSlug && !article);
      return article
        ? (await apiSend<Article>(`/admin/articles/${article.id}`, "PATCH", body)).data
        : (await apiSend<Article>("/admin/articles", "POST", body)).data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: articleKeys.all });
      queryClient.setQueryData(articleKeys.detail(saved.id), saved);
      form.reset(toFormValues(saved));
      setAutoSlug(false);
      toast.success(SAVED_MESSAGE[saved.publicState]);
      if (!article) router.push(`/admin/articles/${saved.id}`);
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: async () => apiSend(`/admin/articles/${article?.id}`, "DELETE"),
    onSuccess: async () => {
      if (article) queryClient.removeQueries({ queryKey: articleKeys.detail(article.id) });
      await queryClient.invalidateQueries({ queryKey: articleKeys.all });
      form.reset();
      toast.success("Artikel dipindahkan ke Sampah.");
      router.push("/admin/articles");
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      setConfirmDelete(false);
    },
  });

  const saveLabel = publishMode === "draft" ? "Simpan draf" : publishMode === "schedule" ? "Jadwalkan" : "Tayangkan";

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 space-y-6">
          <FormField id={sid("title")} label="Judul artikel" required error={errors.title?.message}>
            <Input {...form.register("title")} placeholder="Mis. Mengenal drone mapping untuk survei lahan" />
          </FormField>
          <Controller
            control={form.control}
            name="slug"
            render={({ field }) => (
              <SlugField
                id={sid("slug")}
                entity="article"
                value={field.value}
                onChange={field.onChange}
                source={title}
                auto={autoSlug}
                onAutoChange={setAutoSlug}
                excludeId={article?.id}
                prefix="/artikel/"
                error={errors.slug?.message}
                publishedSlug={article?.publicState === "PUBLISHED" ? article.slug : null}
              />
            )}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField id={sid("author")} label="Penulis / tim" required error={errors.authorName?.message}>
              <Input {...form.register("authorName")} placeholder="Mis. Tim Media" />
            </FormField>
            <Controller
              control={form.control}
              name="categoryId"
              render={({ field }) => {
                // Root Select tidak merender elemen DOM, jadi id/aria dipasang langsung di trigger
                // (FormField memasangnya ke anak langsung).
                const empty = categories.data?.length === 0;
                const describedBy =
                  [empty ? sid("category-help") : null, errors.categoryId ? sid("category-error") : null]
                    .filter(Boolean)
                    .join(" ") || undefined;
                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={sid("category")}>
                        Kategori
                        <span aria-hidden className="text-fg-muted">
                          *
                        </span>
                      </Label>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-small"
                        onClick={() => setCategoriesOpen(true)}
                      >
                        Kelola kategori
                      </Button>
                    </div>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id={sid("category")}
                        className="w-full"
                        onBlur={field.onBlur}
                        aria-invalid={errors.categoryId ? true : undefined}
                        aria-describedby={describedBy}
                      >
                        <SelectValue placeholder={categories.isPending ? "Memuat..." : "Pilih kategori"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(categories.data ?? []).map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {empty ? (
                      <p id={sid("category-help")} className="text-small text-fg-muted">
                        Belum ada kategori. Tambahkan lewat Kelola kategori.
                      </p>
                    ) : null}
                    {errors.categoryId ? (
                      <p id={sid("category-error")} className="text-small text-status-error">
                        {errors.categoryId.message}
                      </p>
                    ) : null}
                  </div>
                );
              }}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              id={sid("source-name")}
              label="Nama sumber"
              description="Opsional, mis. Kementerian Perhubungan RI."
              error={errors.sourceName?.message}
            >
              <Input {...form.register("sourceName")} />
            </FormField>
            <FormField
              id={sid("source-url")}
              label="Tautan sumber"
              description="Opsional, diawali https://."
              error={errors.sourceUrl?.message}
            >
              <Input type="url" inputMode="url" {...form.register("sourceUrl")} placeholder="https://" />
            </FormField>
          </div>
          <FormField
            id={sid("excerpt")}
            label="Ringkasan singkat"
            description={`2-3 kalimat untuk kartu artikel dan deskripsi SEO bawaan. ${excerpt.length}/${EXCERPT_MAX} karakter.`}
            error={errors.excerpt?.message}
          >
            <Textarea rows={3} {...form.register("excerpt")} />
          </FormField>
          <Controller
            control={form.control}
            name="body"
            render={({ field, fieldState }) => (
              <FormField
                id={sid("body")}
                label="Isi artikel"
                required
                description="Subjudul (H2/H3), daftar, kutipan, tebal/miring, dan tautan. Draf boleh belum lengkap."
                error={fieldState.error?.message}
              >
                <RichTextEditor
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  minHeight={360}
                  aria-label="Isi artikel"
                />
              </FormField>
            )}
          />
        </div>

        <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-label uppercase text-fg-muted">Publikasi</h2>
              {article ? <PublicStateLabel state={article.publicState} /> : null}
            </div>
            <Controller
              control={form.control}
              name="publishMode"
              render={({ field }) => (
                <fieldset className="space-y-2">
                  <legend className="sr-only">Status publikasi</legend>
                  {PUBLISH_MODES.map((mode) => (
                    <label
                      key={mode.value}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-fg-strong"
                    >
                      <input
                        type="radio"
                        name={field.name}
                        value={mode.value}
                        checked={field.value === mode.value}
                        onChange={() => field.onChange(mode.value)}
                        className="mt-1 accent-[var(--fg-strong)]"
                      />
                      <span>
                        <span className="block text-sm font-medium">{mode.label}</span>
                        <span className="block text-small text-fg-muted">{mode.help}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            />
            {publishMode === "schedule" ? (
              <Controller
                control={form.control}
                name="publishedAt"
                render={({ field }) => (
                  <FormField
                    id={sid("published-at")}
                    label="Waktu tayang (WIB)"
                    description="Tampil otomatis saat waktunya tiba (paling lambat 30 detik setelahnya)."
                    error={errors.publishedAt?.message}
                  >
                    <Input type="datetime-local" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                  </FormField>
                )}
              />
            ) : null}
            {publishMode === "now" && article?.publicState === "PUBLISHED" && article.publishedAt ? (
              <p className="text-small text-fg-muted">Waktu tayang tetap {toWibInputValue(article.publishedAt).replace("T", " ")} WIB.</p>
            ) : null}
          </section>

          <Controller
            control={form.control}
            name="coverId"
            render={({ field, fieldState }) => (
              <PanelSection title="Foto sampul">
                <FormField
                  id={sid("cover")}
                  label="Gambar utama artikel"
                  description="Rasio 4:3 atau 16:9. Upload file, pilih dari media library, atau ambil dari URL gambar."
                  error={fieldState.error?.message}
                >
                  <MediaPicker
                    value={field.value}
                    onChange={field.onChange}
                    initialMedia={article?.cover}
                    dialogTitle="Pilih foto sampul"
                    allowUrlImport
                  />
                </FormField>
              </PanelSection>
            )}
          />

          <PanelSection title="SEO">
            <Controller
              control={form.control}
              name="seo"
              render={({ field }) => (
                <SeoPanel
                  value={field.value}
                  onChange={field.onChange}
                  fallbackTitle={title}
                  fallbackDescription={excerpt}
                  ogImage={article?.ogImage}
                  errors={{
                    title: errors.seo?.title?.message,
                    description: errors.seo?.description?.message,
                    ogImageId: errors.seo?.ogImageId?.message,
                  }}
                />
              )}
            />
          </PanelSection>

          {article ? (
            <PanelSection title="Lainnya">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-status-error"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon aria-hidden />
                Hapus artikel
              </Button>
            </PanelSection>
          ) : null}
        </aside>
      </form>
      <StickySaveBar
        formId={formId}
        dirty={dirty}
        pending={save.isPending}
        saveLabel={saveLabel}
        onReset={() => form.reset()}
        extra={
          article ? (
            <Button variant="outline" asChild>
              <a
                href={articlePreviewHref(article.id)}
                target="_blank"
                rel="noreferrer"
                title={dirty ? "Pratinjau menampilkan versi yang terakhir disimpan." : undefined}
              >
                <EyeIcon aria-hidden />
                Pratinjau{dirty ? " (versi tersimpan)" : ""}
              </a>
            </Button>
          ) : null
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus "${article?.title ?? ""}"?`}
        description="Artikel dipindahkan ke Sampah dan hilang dari situs."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
      {categoriesOpen ? <ArticleCategoriesDialog onClose={() => setCategoriesOpen(false)} /> : null}
    </>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-6">
      <h2 className="font-mono text-label uppercase text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}
