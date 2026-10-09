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
import {
  AudienceEditor,
  FaqEditor,
  ModulesEditor,
  StringListEditor,
} from "@/components/admin/training-editors";
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
import {
  AUDIENCE_NOTE_MAX,
  AUDIENCE_ROLE_MAX,
  FACILITIES_MAX,
  FACILITY_MAX,
  FAQ_A_MAX,
  FAQ_Q_MAX,
  MODULE_POINT_MAX,
  MODULE_POINTS_MAX,
  MODULE_TITLE_MAX,
  OUTCOME_MAX,
  OUTCOMES_MAX,
  OUTCOMES_MIN,
  PREREQUISITES_MAX,
  SUMMARY_MAX,
} from "@/lib/training-content";
import { METHOD_LABELS, TYPE_LABELS } from "@/lib/labels";
import { categoryKeys } from "../categories/category-form";
import { trainingKeys } from "./training-keys";
import { previewHref } from "./trainings-list";

const FORM_ID = "training-form";
const NO_METHOD = "none";

const richText = z.custom<RichTextDoc | null>((value) => value === null || typeof value === "object");

const requiredItem = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} tidak boleh kosong.` })
    .max(max, { error: `${label} maksimal ${max} karakter.` });

const schema = z
  .object({
    title: z.string().trim().min(1, { error: "Judul wajib diisi." }).max(200, { error: "Judul maksimal 200 karakter." }),
    slug: z.string().trim().max(120, { error: "Slug maksimal 120 karakter." }),
    summary: z.string().trim().max(SUMMARY_MAX, { error: `Ringkasan maksimal ${SUMMARY_MAX} karakter.` }),
    description: richText,
    outcomes: z.array(requiredItem("Hasil belajar", OUTCOME_MAX)).max(OUTCOMES_MAX, {
      error: `Hasil belajar maksimal ${OUTCOMES_MAX} item.`,
    }),
    modules: z.array(
      z.object({
        title: requiredItem("Judul modul", MODULE_TITLE_MAX),
        points: z.array(requiredItem("Poin materi", MODULE_POINT_MAX)).max(MODULE_POINTS_MAX),
        durationMinutes: z
          .number()
          .int()
          .min(1, { error: "Durasi minimal 1 menit." })
          .max(600, { error: "Durasi maksimal 600 menit." })
          .nullable(),
      }),
    ),
    audience: z.array(
      z.object({
        role: requiredItem("Peran", AUDIENCE_ROLE_MAX),
        note: z.string().trim().max(AUDIENCE_NOTE_MAX, { error: `Catatan maksimal ${AUDIENCE_NOTE_MAX} karakter.` }).nullable(),
      }),
    ),
    prerequisites: z.string().trim().max(PREREQUISITES_MAX, { error: `Prasyarat maksimal ${PREREQUISITES_MAX} karakter.` }),
    useDefaultFacilities: z.boolean(),
    facilities: z.array(requiredItem("Fasilitas", FACILITY_MAX)).max(FACILITIES_MAX),
    faq: z.array(z.object({ q: requiredItem("Pertanyaan", FAQ_Q_MAX), a: requiredItem("Jawaban", FAQ_A_MAX) })),
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
  // Sama dengan aturan BE: hasil belajar lengkap hanya wajib saat Tayang (termasuk terjadwal).
  .refine(
    (value) =>
      value.status !== "PUBLISHED" ||
      (value.outcomes.length >= OUTCOMES_MIN && value.outcomes.length <= OUTCOMES_MAX),
    {
      error: `Isi ${OUTCOMES_MIN}-${OUTCOMES_MAX} hasil belajar sebelum menayangkan.`,
      path: ["outcomes"],
    },
  );
type FormValues = z.infer<typeof schema>;

const FIELD_NAMES = Object.keys(schema.shape) as (keyof FormValues)[];

function toFormValues(training: Training | null): FormValues {
  return {
    title: training?.title ?? "",
    slug: training?.slug ?? "",
    summary: training?.summary ?? "",
    description: training?.description ?? null,
    outcomes: training?.outcomes ?? [],
    modules: training?.modules ?? [],
    audience: training?.audience ?? [],
    prerequisites: training?.prerequisites ?? "",
    useDefaultFacilities: training ? training.facilities === null : true,
    facilities: training?.facilities ?? [],
    faq: training?.faq ?? [],
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
    description: values.description,
    outcomes: values.outcomes,
    modules: values.modules,
    audience: values.audience.map((item) => ({ role: item.role, note: item.note || null })),
    prerequisites: values.prerequisites || null,
    // Toggle "Pakai fasilitas default" = null (BE memakai daftar global).
    facilities: values.useDefaultFacilities ? null : values.facilities,
    faq: values.faq,
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

function paragraphCount(doc: RichTextDoc | null): number {
  return doc?.content.filter((node) => node.type === "paragraph" && (node.content?.length ?? 0) > 0).length ?? 0;
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

  const description = useWatch({ control: form.control, name: "description" });
  const outcomes = useWatch({ control: form.control, name: "outcomes" });
  const useDefaultFacilities = useWatch({ control: form.control, name: "useDefaultFacilities" });
  const status = useWatch({ control: form.control, name: "status" });
  const paragraphs = paragraphCount(description);
  // Pesan error array: dari refine (root) atau dari skema array.
  const outcomesError = errors.outcomes?.message ?? errors.outcomes?.root?.message;

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
            description={`Satu kalimat. Tampil di bawah judul, kartu katalog, dan hasil pencarian. ${summary.length}/${SUMMARY_MAX} karakter.`}
            error={errors.summary?.message}
          >
            <Textarea rows={2} {...form.register("summary")} />
          </FormField>

          <Controller
            control={form.control}
            name="description"
            render={({ field, fieldState }) => (
              <FormField
                id="training-description"
                label="Deskripsi"
                description={
                  paragraphs > 2
                    ? `Saat ini ${paragraphs} paragraf. Disarankan maksimal 2 paragraf; detail lain masuk ke hasil belajar & materi.`
                    : "Maksimal 2 paragraf."
                }
                error={fieldState.error?.message}
              >
                <RichTextEditor value={field.value} onChange={field.onChange} onBlur={field.onBlur} aria-label="Deskripsi" />
              </FormField>
            )}
          />

          <ContentSection
            title="Hasil belajar"
            description={`${OUTCOMES_MIN}-${OUTCOMES_MAX} poin, maks ${OUTCOME_MAX} karakter. Wajib lengkap saat Tayang.`}
            status={
              outcomes.length >= OUTCOMES_MIN
                ? null
                : status === "PUBLISHED"
                  ? `Perlu ${OUTCOMES_MIN - outcomes.length} poin lagi untuk tayang.`
                  : `Draf boleh belum lengkap (${outcomes.length}/${OUTCOMES_MIN}).`
            }
            error={outcomesError}
          >
            <Controller
              control={form.control}
              name="outcomes"
              render={({ field }) => (
                <StringListEditor
                  value={field.value}
                  onChange={field.onChange}
                  errors={errors.outcomes}
                  max={OUTCOMES_MAX}
                  itemMax={OUTCOME_MAX}
                  itemName="Hasil belajar"
                  addLabel="Tambah hasil belajar"
                  placeholder="Mis. Menetapkan baseline dan target pengukuran"
                  emptyText="Belum ada hasil belajar."
                />
              )}
            />
          </ContentSection>

          <ContentSection title="Materi" description="Modul berurutan; tiap modul punya poin dan durasi opsional (menit).">
            <Controller
              control={form.control}
              name="modules"
              render={({ field }) => <ModulesEditor value={field.value} onChange={field.onChange} errors={errors.modules} />}
            />
          </ContentSection>

          <ContentSection title="Target peserta" description="Peran yang cocok mengikuti, dengan catatan singkat bila perlu.">
            <Controller
              control={form.control}
              name="audience"
              render={({ field }) => <AudienceEditor value={field.value} onChange={field.onChange} errors={errors.audience} />}
            />
          </ContentSection>

          <FormField
            id="training-prerequisites"
            label="Prasyarat"
            description={`Opsional. Kosongkan kalau tidak ada. Maks ${PREREQUISITES_MAX} karakter.`}
            error={errors.prerequisites?.message}
          >
            <Textarea rows={2} {...form.register("prerequisites")} />
          </FormField>

          <ContentSection title="Fasilitas">
            <Controller
              control={form.control}
              name="useDefaultFacilities"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Switch
                    id="training-default-facilities"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-describedby="training-default-facilities-help"
                  />
                  <div>
                    <Label htmlFor="training-default-facilities">Pakai fasilitas default</Label>
                    <p id="training-default-facilities-help" className="mt-1 text-small text-fg-muted">
                      Daftar default diatur di Pengaturan situs, tab Pelatihan.
                    </p>
                  </div>
                </div>
              )}
            />
            {!useDefaultFacilities ? (
              <Controller
                control={form.control}
                name="facilities"
                render={({ field }) => (
                  <StringListEditor
                    value={field.value}
                    onChange={field.onChange}
                    errors={errors.facilities}
                    max={FACILITIES_MAX}
                    itemMax={FACILITY_MAX}
                    itemName="Fasilitas"
                    addLabel="Tambah fasilitas"
                    emptyText="Belum ada fasilitas khusus."
                  />
                )}
              />
            ) : null}
          </ContentSection>

          <ContentSection title="FAQ pelatihan" description="Tampil sebelum FAQ umum dari Pengaturan.">
            <Controller
              control={form.control}
              name="faq"
              render={({ field }) => <FaqEditor value={field.value} onChange={field.onChange} errors={errors.faq} />}
            />
          </ContentSection>

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
              description="Teks bebas, mis. Rp4.500.000 per peserta. Dipakai kalau belum ada sesi berharga."
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
                        ? "Situs menampilkan harga sesi termurah, lalu teks investasi, lalu Hubungi marketing."
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

function ContentSection({
  title,
  description,
  status,
  error,
  children,
}: {
  title: string;
  description?: string;
  status?: string | null;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-3 border-t border-border pt-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="mt-1 text-small text-fg-muted">{description}</p> : null}
        {status ? <p className="mt-1 text-small text-status-warning">{status}</p> : null}
        {error ? (
          <p role="alert" className="mt-1 text-small text-status-error">
            {error}
          </p>
        ) : null}
      </div>
      {children}
    </fieldset>
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
