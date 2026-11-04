"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, MergeIcon, PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { IconPicker } from "@/components/admin/icon-picker";
import { GalleryEditor } from "@/components/admin/media/gallery-editor";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { SlugField } from "@/components/admin/slug-field";
import { SortableList } from "@/components/admin/sortable-list";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { TagInput } from "@/components/admin/tag-input";
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
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useScopedId } from "@/hooks/use-scoped-id";
import { ApiError, apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type {
  Category,
  CategoryAudienceItem,
  CategoryAudienceSource,
  CategoryAudienceSuggestions,
  CategoryInUseDetails,
} from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";
import { formatNumber } from "@/lib/format";
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
const SUMMARY_MAX = 160;
const COVER_ALT_MAX = 300;
const AUDIENCE_MAX = 12;
const AUDIENCE_LABEL_MAX = 120;
const GALLERY_MAX = 4;

const audienceItemSchema = z.object({
  label: z.string().trim().min(1, { error: "Peran wajib diisi." }).max(AUDIENCE_LABEL_MAX, { error: `Peran maksimal ${AUDIENCE_LABEL_MAX} karakter.` }),
  trainingCount: z.number().int().min(0).nullable(),
});

const schema = z.object({
  name: z.string().trim().min(1, { error: "Nama wajib diisi." }).max(100, { error: "Nama maksimal 100 karakter." }),
  slug: z.string().trim().max(120, { error: "Slug maksimal 120 karakter." }),
  description: z.string().trim().max(1000, { error: "Deskripsi maksimal 1000 karakter." }),
  summary: z.string().trim().max(SUMMARY_MAX, { error: `Ringkasan maksimal ${SUMMARY_MAX} karakter.` }),
  icon: z.string().nullable(),
  featured: z.boolean(),
  imageId: z.string().nullable(),
  coverAlt: z.string().trim().max(COVER_ALT_MAX, { error: `Alt maksimal ${COVER_ALT_MAX} karakter.` }),
  audience: z.array(audienceItemSchema).max(AUDIENCE_MAX, { error: `Target peserta maksimal ${AUDIENCE_MAX} item.` }),
  audienceSource: z.enum(["manual", "auto"]),
  imageIds: z.array(z.string()).max(GALLERY_MAX, { error: `Galeri maksimal ${GALLERY_MAX} gambar.` }),
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
  const inUse = (category?.trainingCount ?? 0) > 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      summary: category?.summary ?? "",
      icon: category?.icon ?? null,
      featured: category?.featured ?? false,
      imageId: category?.imageId ?? null,
      coverAlt: category?.coverAlt ?? "",
      audience: category?.audience ?? [],
      audienceSource: category?.audienceSource ?? "manual",
      imageIds: category?.imageIds ?? [],
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
      const body = {
        ...values,
        description: values.description || null,
        summary: values.summary || null,
        coverAlt: values.coverAlt || null,
        slug,
      };
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
        summary: saved.summary ?? "",
        icon: saved.icon,
        featured: saved.featured,
        imageId: saved.imageId,
        coverAlt: saved.coverAlt ?? "",
        audience: saved.audience,
        audienceSource: saved.audienceSource,
        imageIds: saved.imageIds,
        keywords: saved.keywords,
      });
      setAutoSlug(false);
      toast.success(category ? "Kategori disimpan." : "Kategori ditambahkan.");
      if (!category) router.push(`/admin/categories/${saved.id}`);
    },
    onError: (error) => {
      if (
        !applyFieldErrors(error, form.setError, [
          "name",
          "slug",
          "description",
          "summary",
          "icon",
          "featured",
          "imageId",
          "coverAlt",
          "audience",
          "audienceSource",
          "imageIds",
          "keywords",
        ])
      ) {
        toast.error(errorMessage(error));
      }
    },
  });

  // Kategori yang masih dipakai tidak bisa dihapus (satu pelatihan satu kategori): dialog hapus
  // mengarahkan ke Gabungkan atau aksi massal pindah kategori.
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
  const audienceSource = useWatch({ control: form.control, name: "audienceSource" });
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
            id={sid("summary")}
            label="Ringkasan"
            description="Satu kalimat; dipakai sebagai deskripsi halaman kategori untuk mesin pencari. Kosong = diambil dari awal deskripsi."
            error={errors.summary?.message}
          >
            <Input {...form.register("summary")} maxLength={SUMMARY_MAX} />
          </FormField>
          <FormField
            id={sid("description")}
            label="Deskripsi"
            description="Tentang kategori di halaman landing. Pisahkan paragraf dengan baris kosong."
            error={errors.description?.message}
          >
            <Textarea rows={6} {...form.register("description")} />
          </FormField>
          <Controller
            control={form.control}
            name="audience"
            render={({ field }) => (
              <AudienceEditor
                id={sid("audience")}
                value={field.value}
                onChange={(next, source) => {
                  field.onChange(next);
                  if (source) form.setValue("audienceSource", source, { shouldDirty: true });
                }}
                categoryId={category?.id ?? null}
                source={audienceSource}
                max={AUDIENCE_MAX}
                labelMax={AUDIENCE_LABEL_MAX}
                error={errors.audience?.message ?? errors.audience?.root?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="imageIds"
            render={({ field, fieldState }) => (
              <FormField
                id={sid("gallery")}
                label="Galeri kategori"
                description={`Maksimal ${GALLERY_MAX} foto dokumentasi. Setiap gambar wajib punya alt. Menggantikan galeri per pelatihan.`}
                error={fieldState.error?.message ?? fieldState.error?.root?.message}
              >
                <GalleryEditor
                  value={field.value}
                  onChange={field.onChange}
                  initialMedia={category?.images ?? []}
                  max={GALLERY_MAX}
                />
              </FormField>
            )}
          />
          <Controller
            control={form.control}
            name="keywords"
            render={({ field }) => (
              <FormField
                id={sid("keywords")}
                label="Kata kunci"
                description="Pelatihan yang judulnya memuat salah satu kata ini muncul di daftar Pelatihan yang cocok. Tidak ada yang dipindah otomatis. Tekan Enter atau koma untuk menambah."
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
                label="Gambar cover"
                description="Wajib punya alt text. Cover halaman kategori dan gambar pelatihan yang belum punya sampul."
                error={fieldState.error?.message}
              >
                <MediaPicker value={field.value} onChange={field.onChange} initialMedia={category?.image} dialogTitle="Pilih gambar cover kategori" />
              </FormField>
            )}
          />
          <FormField
            id={sid("coverAlt")}
            label="Alt cover (opsional)"
            description="Teks alternatif khusus landing. Kosong = pakai alt dari media library."
            error={errors.coverAlt?.message}
          >
            <Input {...form.register("coverAlt")} maxLength={COVER_ALT_MAX} />
          </FormField>
          {category ? (
            <a
              href={`/pelatihan/kategori/${category.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-small text-fg-strong underline underline-offset-4"
            >
              Pratinjau halaman kategori
              <ExternalLinkIcon className="size-3.5" aria-hidden />
              <span className="sr-only">(tab baru)</span>
            </a>
          ) : null}
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
                  onClick={() => setConfirmDelete(true)}
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
        title={inUse ? `Kategori "${category?.name ?? ""}" masih dipakai` : `Hapus kategori "${category?.name ?? ""}"?`}
        description={
          inUse
            ? `Kategori ini berisi ${formatNumber(category?.trainingCount ?? 0)} pelatihan, dan setiap pelatihan hanya punya satu kategori. Gabungkan ke kategori lain (pelatihannya ikut pindah), atau pindahkan pelatihannya lewat aksi massal "Pindah kategori" di daftar pelatihan.`
            : "Kategori dipindahkan ke Sampah dan hilang dari situs. Item menu ke kategori ini ikut dihapus. Bisa dipulihkan dalam 30 hari."
        }
        confirmLabel={inUse ? "Gabungkan ke kategori lain" : "Hapus"}
        destructive={!inUse}
        pending={remove.isPending}
        onConfirm={() => {
          if (!inUse) {
            remove.mutate();
            return;
          }
          setConfirmDelete(false);
          setMergeOpen(true);
        }}
      >
        {inUse && category ? (
          <Link href={`/admin/trainings?categoryId=${category.id}`} className="text-small underline underline-offset-4">
            Lihat {formatNumber(category.trainingCount)} pelatihan di kategori ini
          </Link>
        ) : null}
      </ConfirmDialog>

      {category ? (
        <CategoryMergeDialog category={category} open={mergeOpen} onOpenChange={setMergeOpen} onMerged={() => form.reset()} />
      ) : null}
    </>
  );
}

type AudienceRow = CategoryAudienceItem & { id: string };

// Editor target peserta: tambah/edit/hapus/urutkan (dnd-kit) + "Ambil dari pelatihan" (saran dari
// pelatihan tayang; memilih saran membuat audienceSource jadi "auto"). Edit manual tetap boleh.
function AudienceEditor({
  id,
  value,
  onChange,
  categoryId,
  source,
  max,
  labelMax,
  error,
}: {
  id: string;
  value: CategoryAudienceItem[];
  // source diisi hanya saat perubahan harus mengubah audienceSource (mis. ambil dari pelatihan).
  onChange: (next: CategoryAudienceItem[], source?: CategoryAudienceSource) => void;
  categoryId: string | null;
  source: CategoryAudienceSource;
  max: number;
  labelMax: number;
  error?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // id baris stabil untuk SortableList (data audience tidak menyimpan id).
  const rows: AudienceRow[] = value.map((item, index) => ({ ...item, id: `aud-${index}` }));
  const full = value.length >= max;

  // Mengubah daftar peran manual. Kalau jadi kosong, sumber kembali "manual" (invariant badge).
  const update = (next: CategoryAudienceItem[]) => onChange(next, next.length === 0 ? "manual" : undefined);

  return (
    <>
    <FormField id={id} label="Target peserta" description="Siapa yang cocok ikut. Maksimal 12 peran. Bisa diambil dari pelatihan lalu dirapikan." error={error}>
      <div className="space-y-3">
        {value.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center text-small text-fg-muted">
            Belum ada target peserta.
          </p>
        ) : (
          <SortableList
            items={rows}
            itemLabel={(item) => item.label || "peran"}
            onReorder={(ids) => update(ids.flatMap((rowId) => {
              const row = rows.find((candidate) => candidate.id === rowId);
              return row ? [{ label: row.label, trainingCount: row.trainingCount }] : [];
            }))}
            renderItem={(item, handle) => {
              const index = rows.findIndex((row) => row.id === item.id);
              return (
                <div className="flex items-start gap-2 py-2">
                  {handle}
                  <div className="min-w-0 flex-1 space-y-1">
                    <Input
                      aria-label={`Peran ${index + 1}`}
                      value={item.label}
                      maxLength={labelMax}
                      onChange={(event) => {
                        const next = value.map((row, i) => (i === index ? { ...row, label: event.target.value } : row));
                        update(next);
                      }}
                    />
                    <label className="flex items-center gap-2 text-small text-fg-muted">
                      Jumlah pelatihan (opsional)
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-24"
                        value={item.trainingCount ?? ""}
                        onChange={(event) => {
                          const raw = event.target.value;
                          const count = raw === "" ? null : Math.max(0, Math.trunc(Number(raw)));
                          const next = value.map((row, i) =>
                            i === index ? { ...row, trainingCount: Number.isFinite(count as number) ? count : null } : row,
                          );
                          update(next);
                        }}
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Hapus peran ${index + 1}`}
                    onClick={() => update(value.filter((_, i) => i !== index))}
                  >
                    <XIcon strokeWidth={1.5} aria-hidden />
                  </Button>
                </div>
              );
            }}
          />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={full}
            onClick={() => update([...value, { label: "", trainingCount: null }])}
          >
            <PlusIcon aria-hidden />
            Tambah peran
          </Button>
          {categoryId ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <SparklesIcon aria-hidden />
              Ambil dari pelatihan
            </Button>
          ) : null}
          <p className="text-small text-fg-muted">
            {value.length}/{max}
            {source === "auto" ? " · diambil dari pelatihan" : ""}
          </p>
        </div>
      </div>
    </FormField>
      {/* Di luar FormField: Slot di FormField hanya menerima satu elemen anak. */}
      {pickerOpen && categoryId ? (
        <AudienceSuggestionDialog
          categoryId={categoryId}
          existing={value}
          max={max}
          onClose={() => setPickerOpen(false)}
          onApply={(items) => {
            setPickerOpen(false);
            onChange(items, "auto");
          }}
        />
      ) : null}
    </>
  );
}

// Peran generik dari seed katalog referensi: "Staf dan praktisi bidang ..." / "Supervisor dan
// manajer terkait". Dipakai untuk memperingatkan (bukan memfilter) di dialog ambil dari pelatihan.
function isGenericRole(label: string): boolean {
  const normalized = label.trim().toLocaleLowerCase("id-ID");
  return normalized.startsWith("staf dan praktisi bidang ") || normalized === "supervisor dan manajer terkait";
}

// Dialog "Ambil dari pelatihan": tampilkan saran peran + jumlah pelatihan, admin mencentang yang
// dipakai, lalu dimasukkan ke daftar (menggantikan daftar saat ini) dan audienceSource jadi "auto".
function AudienceSuggestionDialog({
  categoryId,
  existing,
  max,
  onClose,
  onApply,
}: {
  categoryId: string;
  existing: CategoryAudienceItem[];
  max: number;
  onClose: () => void;
  onApply: (items: CategoryAudienceItem[]) => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(existing.map((item) => item.label)));

  const query = useQuery({
    queryKey: ["admin", "categories", "audience-suggestions", categoryId],
    queryFn: async () =>
      (await apiFetch<CategoryAudienceSuggestions>(`/admin/categories/${categoryId}/audience-suggestions`)).data,
  });
  const suggestions = query.data?.suggestions ?? [];
  const selectedCount = suggestions.filter((item) => checked.has(item.label)).length;
  // Pola peran generik dari seed katalog referensi (bukan hasil edit admin).
  const allGeneric =
    suggestions.length > 0 && suggestions.every((item) => isGenericRole(item.label));

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ambil target peserta dari pelatihan</DialogTitle>
          <DialogDescription>
            {query.data
              ? `Dirangkum dari ${formatNumber(query.data.trainingsConsidered)} pelatihan tayang. Centang peran yang dipakai (maks ${max}).`
              : "Merangkum target peserta dari pelatihan tayang di kategori ini."}
          </DialogDescription>
        </DialogHeader>

        {allGeneric ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-small text-status-warning">
            Data target peserta pelatihan di kategori ini masih generik, sebaiknya isi manual.
          </p>
        ) : null}

        {query.isPending ? (
          <p className="py-6 text-center text-small text-fg-muted">Memuat saran...</p>
        ) : query.isError ? (
          <p className="py-6 text-center text-small text-status-error">
            Gagal memuat saran.{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => void query.refetch()}>
              Coba lagi
            </button>
          </p>
        ) : suggestions.length === 0 ? (
          <p className="py-6 text-center text-small text-fg-muted">Belum ada target peserta di pelatihan kategori ini.</p>
        ) : (
          <ul className="space-y-1">
            {suggestions.map((item) => {
              const isChecked = checked.has(item.label);
              const disabled = !isChecked && selectedCount >= max;
              return (
                <li key={item.label}>
                  <label className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${disabled ? "opacity-50" : "hover:bg-muted"}`}>
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={(event) => {
                          setChecked((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) next.add(item.label);
                            else next.delete(item.label);
                            return next;
                          });
                        }}
                      />
                      {item.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{item.trainingCount} pelatihan</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={selectedCount === 0}
            onClick={() =>
              onApply(
                suggestions
                  .filter((item) => checked.has(item.label))
                  .slice(0, max)
                  .map((item) => ({ label: item.label, trainingCount: item.trainingCount })),
              )
            }
          >
            Masukkan {selectedCount > 0 ? `(${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
