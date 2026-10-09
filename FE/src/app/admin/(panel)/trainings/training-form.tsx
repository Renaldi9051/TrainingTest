"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDaysIcon, CopyIcon, EyeIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
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
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { CategoryOption, RichTextDoc, Training, TrainingMethod, TrainingType } from "@/lib/api/types";
import { fromWibInputValue, toWibInputValue } from "@/lib/format";
import { applyFieldErrors } from "@/lib/form-errors";
import { METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
import { categoryKeys } from "../categories/category-form";
import { trainingKeys } from "./training-keys";
import { previewHref } from "./trainings-list";

const FORM_ID = "training-form";
const NO_METHOD = "none";

const richText = z.custom<RichTextDoc | null>((value) => value === null || typeof value === "object");

const schema = z
  .object({
    title: z.string().trim().min(1, { error: "Judul wajib diisi." }).max(200, { error: "Judul maksimal 200 karakter." }),
    slug: z.string().trim().max(120, { error: "Slug maksimal 120 karakter." }),
    summary: z.string().trim().max(500, { error: "Ringkasan maksimal 500 karakter." }),
    body: richText,
    objectives: richText,
    syllabus: richText,
    audience: richText,
    facilities: richText,
    duration: z.string().trim().max(100, { error: "Durasi maksimal 100 karakter." }),
    method: z.string(),
    types: z.array(z.enum(["PUBLIC", "IN_HOUSE"])),
    priceText: z.string().trim().max(200, { error: "Investasi maksimal 200 karakter." }),
    showPrice: z.boolean(),
    coverId: z.string().nullable(),
    categoryIds: z.array(z.string()).min(1, { error: "Pilih minimal satu kategori." }),
    status: z.enum(["DRAFT", "PUBLISHED"]),
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
  .refine((value) => !value.showPrice || value.priceText !== "", {
    error: "Isi teks investasi atau matikan opsi tampilkan harga.",
    path: ["priceText"],
  });
type FormValues = z.infer<typeof schema>;

const FIELD_NAMES = Object.keys(schema.shape) as (keyof FormValues)[];

function toFormValues(training: Training | null): FormValues {
  return {
    title: training?.title ?? "",
    slug: training?.slug ?? "",
    summary: training?.summary ?? "",
    body: training?.body ?? null,
    objectives: training?.objectives ?? null,
    syllabus: training?.syllabus ?? null,
    audience: training?.audience ?? null,
    facilities: training?.facilities ?? null,
    duration: training?.duration ?? "",
    method: training?.method ?? NO_METHOD,
    types: training?.types ?? [],
    priceText: training?.priceText ?? "",
    showPrice: training?.showPrice ?? false,
    coverId: training?.coverId ?? null,
    categoryIds: training?.categories.map((category) => category.id) ?? [],
    status: training?.status ?? "DRAFT",
    publishedAt: toWibInputValue(training?.publishedAt ?? null),
    seo: training?.seo ?? { title: "", description: "", ogImageId: null },
  };
}

// autoSlug: slug masih mengikuti judul, jadi tidak dikirim; BE membuat slug unik sendiri
// (dengan sufiks kalau bentrok) alih-alih menolak dengan 409.
function toBody(values: FormValues, autoSlug: boolean) {
  return {
    title: values.title,
    slug: autoSlug ? undefined : values.slug || undefined,
    summary: values.summary || null,
    body: values.body,
    objectives: values.objectives,
    syllabus: values.syllabus,
    audience: values.audience,
    facilities: values.facilities,
    duration: values.duration || null,
    method: values.method === NO_METHOD ? null : (values.method as TrainingMethod),
    types: values.types,
    priceText: values.priceText || null,
    showPrice: values.showPrice,
    coverId: values.coverId,
    categoryIds: values.categoryIds,
    status: values.status,
    publishedAt: fromWibInputValue(values.publishedAt),
    seo: values.seo,
  };
}

export function TrainingForm({ training }: { training: Training | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [autoSlug, setAutoSlug] = useState(training === null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(training),
    mode: "onBlur",
  });
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);
  const errors = form.formState.errors;
  const title = useWatch({ control: form.control, name: "title" });
  const summary = useWatch({ control: form.control, name: "summary" });
  const showPrice = useWatch({ control: form.control, name: "showPrice" });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = toBody(values, autoSlug && !training);
      return training
        ? (await apiSend<Training>(`/admin/trainings/${training.id}`, "PATCH", body)).data
        : (await apiSend<Training>("/admin/trainings", "POST", body)).data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.setQueryData(trainingKeys.detail(saved.id), saved);
      form.reset(toFormValues(saved));
      setAutoSlug(false);
      const message =
        saved.publicState === "PUBLISHED"
          ? "Pelatihan disimpan dan tayang. Situs diperbarui dalam beberapa detik."
          : saved.publicState === "SCHEDULED"
            ? "Pelatihan disimpan dan dijadwalkan tayang."
            : "Pelatihan disimpan sebagai draf.";
      toast.success(message);
      if (!training) router.push(`/admin/trainings/${saved.id}`);
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
    },
  });

  const duplicate = useMutation({
    mutationFn: async () => (await apiSend<Training>(`/admin/trainings/${training?.id}/duplicate`, "POST")).data,
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      toast.success("Salinan dibuat sebagai draf.");
      router.push(`/admin/trainings/${copy.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: async () => apiSend(`/admin/trainings/${training?.id}`, "DELETE"),
    onSuccess: async () => {
      if (training) queryClient.removeQueries({ queryKey: trainingKeys.detail(training.id) });
      await queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      form.reset();
      toast.success("Pelatihan dipindahkan ke Sampah.");
      router.push("/admin/trainings");
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      setConfirmDelete(false);
    },
  });

  const richField = (name: "body" | "objectives" | "syllabus" | "audience" | "facilities", label: string, description?: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField id={`training-${name}`} label={label} description={description} error={fieldState.error?.message}>
          <RichTextEditor value={field.value} onChange={field.onChange} onBlur={field.onBlur} aria-label={label} />
        </FormField>
      )}
    />
  );

  return (
    <>
      <form
        id={FORM_ID}
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 space-y-6">
          <FormField id="training-title" label="Judul" required error={errors.title?.message}>
            <Input {...form.register("title")} />
          </FormField>
          <Controller
            control={form.control}
            name="slug"
            render={({ field }) => (
              <SlugField
                id="training-slug"
                entity="training"
                value={field.value}
                onChange={field.onChange}
                source={title}
                auto={autoSlug}
                onAutoChange={setAutoSlug}
                excludeId={training?.id}
                prefix="/pelatihan/"
                error={errors.slug?.message}
                publishedSlug={training?.status === "PUBLISHED" ? training.slug : null}
              />
            )}
          />
          <FormField
            id="training-summary"
            label="Ringkasan"
            description={`Tampil di kartu katalog dan hasil pencarian. ${summary.length}/500 karakter.`}
            error={errors.summary?.message}
          >
            <Textarea rows={3} {...form.register("summary")} />
          </FormField>
          {richField("body", "Deskripsi")}
          {richField("objectives", "Tujuan pelatihan")}
          {richField("syllabus", "Materi / silabus")}
          {richField("audience", "Target peserta")}
          {richField("facilities", "Fasilitas")}

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField id="training-duration" label="Durasi" description="Mis. 2 hari, 16 jam pelajaran." error={errors.duration?.message}>
              <Input {...form.register("duration")} />
            </FormField>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label htmlFor="training-method">Metode</Label>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="training-method" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_METHOD}>Belum diatur</SelectItem>
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
          </div>

          <Controller
            control={form.control}
            name="types"
            render={({ field }) => (
              <fieldset>
                <legend className="text-sm font-medium">Tipe</legend>
                <p className="mt-1 mb-3 text-small text-fg-muted">Satu pelatihan boleh public sekaligus in-house.</p>
                <div className="flex flex-wrap gap-6">
                  {(Object.entries(TYPE_LABELS) as [TrainingType, string][]).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(value)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked ? [...field.value, value] : field.value.filter((type) => type !== value),
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          />

          <div className="space-y-4 border-t border-border pt-6">
            <FormField
              id="training-price"
              label="Investasi"
              description="Teks bebas, mis. Rp4.500.000 per peserta."
              error={errors.priceText?.message}
            >
              <Input {...form.register("priceText")} />
            </FormField>
            <Controller
              control={form.control}
              name="showPrice"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Switch
                    id="training-show-price"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-describedby="training-show-price-help"
                  />
                  <div>
                    <Label htmlFor="training-show-price">Tampilkan harga di situs</Label>
                    <p id="training-show-price-help" className="mt-1 text-small text-fg-muted">
                      {showPrice
                        ? "Investasi dan harga per sesi jadwal tampil di situs."
                        : "Situs menampilkan \"Hubungi marketing\", termasuk di tabel jadwal."}
                    </p>
                  </div>
                </div>
              )}
            />
          </div>
        </div>

        <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
          <PublishPanel control={form.control} training={training} errors={errors.publishedAt?.message} />

          <Controller
            control={form.control}
            name="categoryIds"
            render={({ field }) => (
              <CategoryChecklist value={field.value} onChange={field.onChange} error={errors.categoryIds?.message} />
            )}
          />

          <Controller
            control={form.control}
            name="coverId"
            render={({ field, fieldState }) => (
              <FormField
                id="training-cover"
                label="Gambar sampul"
                description="Rasio 4:3. Tampil grayscale di situs."
                error={fieldState.error?.message}
              >
                <MediaPicker
                  value={field.value}
                  onChange={field.onChange}
                  initialMedia={training?.cover}
                  dialogTitle="Pilih gambar sampul"
                />
              </FormField>
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
                  fallbackDescription={summary}
                  ogImage={training?.ogImage}
                  errors={{
                    title: errors.seo?.title?.message,
                    description: errors.seo?.description?.message,
                    ogImageId: errors.seo?.ogImageId?.message,
                  }}
                />
              )}
            />
          </PanelSection>

          {training ? (
            <PanelSection title="Lainnya">
              <div className="flex flex-col items-start gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/schedules?trainingId=${training.id}`}>
                    <CalendarDaysIcon aria-hidden />
                    Kelola jadwal ({training.scheduleCount})
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={duplicate.isPending}
                  onClick={() => duplicate.mutate()}
                >
                  <CopyIcon aria-hidden />
                  Duplikat
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-status-error"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2Icon aria-hidden />
                  Hapus pelatihan
                </Button>
              </div>
            </PanelSection>
          ) : null}
        </aside>
      </form>

      <StickySaveBar
        formId={FORM_ID}
        dirty={dirty}
        pending={save.isPending}
        onReset={() => form.reset()}
        extra={
          training ? (
            <Button variant="outline" asChild>
              <a
                href={previewHref(training.id)}
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
        title={`Hapus "${training?.title ?? ""}"?`}
        description="Pelatihan dipindahkan ke Sampah dan hilang dari situs beserta jadwalnya. Bisa dipulihkan dalam 30 hari."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
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

function PublishPanel({
  control,
  training,
  errors,
}: {
  control: Control<FormValues>;
  training: Training | null;
  errors?: string;
}) {
  const status = useWatch({ control, name: "status" });
  const publishedAt = useWatch({ control, name: "publishedAt" });
  const scheduled = status === "PUBLISHED" && publishedAt !== "" && new Date(fromWibInputValue(publishedAt) ?? "") > new Date();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-label uppercase text-fg-muted">Publikasi</h2>
        {training ? <PublicStateLabel state={training.publicState} /> : null}
      </div>
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <fieldset className="space-y-2">
            <legend className="sr-only">Status</legend>
            {(
              [
                ["DRAFT", "Draf", "Tidak tampil di situs."],
                ["PUBLISHED", "Tayang", "Tampil di situs pada waktu tayang."],
              ] as const
            ).map(([value, label, help]) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-fg-strong"
              >
                <input
                  type="radio"
                  name={field.name}
                  value={value}
                  checked={field.value === value}
                  onChange={() => field.onChange(value)}
                  className="mt-1 accent-[var(--fg-strong)]"
                />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-small text-fg-muted">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      />
      <Controller
        control={control}
        name="publishedAt"
        render={({ field }) => (
          <FormField
            id="training-published-at"
            label="Waktu tayang (WIB)"
            description={
              status !== "PUBLISHED"
                ? "Dipakai saat status Tayang."
                : scheduled
                  ? "Terjadwal: tampil otomatis saat waktunya tiba (paling lambat 30 detik setelahnya)."
                  : "Kosong = tayang saat disimpan."
            }
            error={errors}
          >
            <Input type="datetime-local" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
          </FormField>
        )}
      />
    </section>
  );
}

function CategoryChecklist({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  const filterId = useId();
  const [filter, setFilter] = useState("");
  const query = useQuery({
    queryKey: categoryKeys.options,
    queryFn: async () => (await apiFetch<CategoryOption[]>("/admin/categories/options")).data,
  });
  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const items = query.data ?? [];
    return term ? items.filter((item) => item.name.toLowerCase().includes(term)) : items;
  }, [filter, query.data]);
  const selected = new Set(value);

  return (
    <fieldset className="space-y-3 border-t border-border pt-6" aria-describedby={error ? `${filterId}-error` : undefined}>
      <legend className="font-mono text-label uppercase text-fg-muted">
        Kategori <span className="normal-case">({value.length} dipilih)</span>
      </legend>
      <div className="relative">
        <label htmlFor={filterId} className="sr-only">
          Cari kategori
        </label>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted"
          strokeWidth={1.5}
          aria-hidden
        />
        <Input
          id={filterId}
          type="search"
          className="pl-9"
          placeholder="Cari kategori"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      {query.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-5" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-small text-status-error">Kategori tidak dapat dimuat.</p>
      ) : visible.length === 0 ? (
        <p className="text-small text-fg-muted">
          {query.data.length === 0 ? (
            <>
              Belum ada kategori. <Link href="/admin/categories/new" className="underline">Tambah kategori</Link>.
            </>
          ) : (
            "Tidak ada kategori yang cocok."
          )}
        </p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {visible.map((category) => (
            <li key={category.id}>
              <label className="flex items-center gap-2 rounded-sm px-1 py-1 text-sm hover:bg-bg-subtle">
                <Checkbox
                  checked={selected.has(category.id)}
                  onCheckedChange={(checked) =>
                    onChange(checked ? [...value, category.id] : value.filter((id) => id !== category.id))
                  }
                />
                {category.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <p id={`${filterId}-error`} className="text-small text-status-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
