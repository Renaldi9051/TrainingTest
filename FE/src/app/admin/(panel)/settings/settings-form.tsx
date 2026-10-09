"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Controller,
  useFieldArray,
  useForm,
  useWatch,
  type DefaultValues,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/admin/form-field";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { Button } from "@/components/admin/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { Textarea } from "@/components/admin/ui/textarea";
import { FaqEditor, StringListEditor } from "@/components/admin/training-editors";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { AdminSettings, SettingKey, SettingValues, SocialPlatform } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";
import { FACILITIES_MAX, FACILITY_MAX, FAQ_A_MAX, FAQ_Q_MAX } from "@/lib/training-content";

export const settingsKey = ["admin", "settings"] as const;

const TABS: { key: SettingKey; label: string }[] = [
  { key: "site.identity", label: "Identitas" },
  { key: "site.header", label: "Header" },
  { key: "site.contact", label: "Kontak" },
  { key: "site.social", label: "Sosial media" },
  { key: "site.footer", label: "Footer" },
  { key: "training.defaults", label: "Pelatihan" },
  { key: "seo.default", label: "SEO default" },
];

export function SettingsForm() {
  const query = useQuery({
    queryKey: settingsKey,
    queryFn: async () => (await apiFetch<AdminSettings>("/admin/settings")).data,
  });
  const [dirtyKeys, setDirtyKeys] = useState<Set<SettingKey>>(new Set());
  const onDirtyChange = useCallback((key: SettingKey, dirty: boolean) => {
    setDirtyKeys((current) => {
      if (current.has(key) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  useUnsavedChangesGuard(dirtyKeys.size > 0);

  if (query.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Memuat pengaturan">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
        <p className="text-small text-status-error">Pengaturan tidak dapat dimuat.</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  }

  const { values, media } = query.data;
  const sectionProps = { media, onDirtyChange };

  return (
    <Tabs defaultValue="site.identity">
      <TabsList aria-label="Grup pengaturan">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            {tab.label}
            {dirtyKeys.has(tab.key) ? (
              <span className="size-1.5 rounded-full bg-status-warning" aria-label="belum disimpan" />
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* forceMount: isi tab lain tetap terpasang supaya perubahan yang belum disimpan tidak hilang. */}
      <TabsContent value="site.identity" forceMount className="data-[state=inactive]:hidden">
        <IdentitySection value={values["site.identity"]} {...sectionProps} />
      </TabsContent>
      <TabsContent value="site.header" forceMount className="data-[state=inactive]:hidden">
        <HeaderSection value={values["site.header"]} {...sectionProps} />
      </TabsContent>
      <TabsContent value="site.contact" forceMount className="data-[state=inactive]:hidden">
        <ContactSection value={values["site.contact"]} {...sectionProps} />
      </TabsContent>
      <TabsContent value="site.social" forceMount className="data-[state=inactive]:hidden">
        <SocialSection value={values["site.social"]} {...sectionProps} />
      </TabsContent>
      <TabsContent value="site.footer" forceMount className="data-[state=inactive]:hidden">
        <FooterSection value={values["site.footer"]} {...sectionProps} />
      </TabsContent>
      <TabsContent value="training.defaults" forceMount className="data-[state=inactive]:hidden">
        <TrainingDefaultsSection value={values["training.defaults"]} {...sectionProps} />
      </TabsContent>
      <TabsContent value="seo.default" forceMount className="data-[state=inactive]:hidden">
        <SeoSection value={values["seo.default"]} {...sectionProps} />
      </TabsContent>
    </Tabs>
  );
}

type SectionProps<K extends SettingKey> = {
  value: SettingValues[K];
  media: AdminSettings["media"];
  onDirtyChange: (key: SettingKey, dirty: boolean) => void;
};

// Satu form per key: simpan lewat PUT /admin/settings/:key, error field BE dipasang ke input.
function useSettingForm<K extends SettingKey, TValues extends FieldValues>(
  key: K,
  schema: z.ZodType<TValues, TValues>,
  value: SettingValues[K],
  onDirtyChange: SectionProps<K>["onDirtyChange"],
  toForm: (value: SettingValues[K]) => TValues = (current) => current as unknown as TValues,
) {
  const queryClient = useQueryClient();
  const form = useForm<TValues>({
    resolver: zodResolver(schema),
    defaultValues: toForm(value) as DefaultValues<TValues>,
    mode: "onBlur",
  });
  const dirty = form.formState.isDirty;
  useEffect(() => onDirtyChange(key, dirty), [key, dirty, onDirtyChange]);

  const mutation = useMutation({
    mutationFn: async (input: TValues) =>
      (await apiSend<AdminSettings>(`/admin/settings/${key}`, "PUT", input)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKey, data);
      form.reset(toForm(data.values[key]) as TValues);
      toast.success("Pengaturan disimpan. Situs diperbarui dalam beberapa detik.");
    },
    onError: (error) => {
      const fields = Object.keys(form.getValues());
      if (!applyFieldErrors(error, form.setError, fields)) toast.error(errorMessage(error));
    },
  });

  const formId = `settings-${key.replace(".", "-")}`;
  const onSubmit = form.handleSubmit((input) => mutation.mutate(input));
  const saveBar = (
    <StickySaveBar
      formId={formId}
      dirty={dirty}
      pending={mutation.isPending}
      onReset={() => form.reset()}
    />
  );
  return { form, formId, onSubmit, saveBar };
}

function SectionForm({
  id,
  onSubmit,
  children,
  saveBar,
}: {
  id: string;
  onSubmit: () => void;
  children: ReactNode;
  saveBar: ReactNode;
}) {
  return (
    <>
      <form
        id={id}
        noValidate
        className="max-w-2xl space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {children}
      </form>
      {saveBar}
    </>
  );
}

const text = (label: string, max: number) =>
  z.string().trim().max(max, { error: `${label} maksimal ${max} karakter.` });

const hrefPattern = /^(\/(?!\/)[^\s\\]*|https?:\/\/\S+)$/;

// ===== Identitas =====

const identitySchema = z.object({
  name: z.string().trim().min(1, { error: "Nama situs wajib diisi." }).max(100, { error: "Nama situs maksimal 100 karakter." }),
  tagline: text("Tagline", 200),
  logoLightId: z.string().nullable(),
  logoDarkId: z.string().nullable(),
  faviconId: z.string().nullable(),
});

function IdentitySection({ value, media, onDirtyChange }: SectionProps<"site.identity">) {
  const { form, formId, onSubmit, saveBar } = useSettingForm("site.identity", identitySchema, value, onDirtyChange);
  const { register, control, formState } = form;
  const errors = formState.errors;
  const picker = (name: "logoLightId" | "logoDarkId" | "faviconId", label: string, aspect: "3/1" | "1/1", description: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField id={`${formId}-${name}`} label={label} description={description} error={fieldState.error?.message}>
          <MediaPicker
            value={field.value}
            onChange={field.onChange}
            initialMedia={field.value ? media[field.value] : null}
            aspect={aspect}
            fit="contain"
            dialogTitle={`Pilih ${label.toLowerCase()}`}
          />
        </FormField>
      )}
    />
  );

  return (
    <SectionForm id={formId} onSubmit={onSubmit} saveBar={saveBar}>
      <FormField id={`${formId}-name`} label="Nama situs" required error={errors.name?.message}>
        <Input {...register("name")} />
      </FormField>
      <FormField id={`${formId}-tagline`} label="Tagline" error={errors.tagline?.message}>
        <Input {...register("tagline")} />
      </FormField>
      <div className="grid gap-6 sm:grid-cols-2">
        {picker("logoLightId", "Logo terang", "3/1", "Dipakai di latar putih (header).")}
        {picker("logoDarkId", "Logo gelap", "3/1", "Dipakai di latar hitam (footer).")}
      </div>
      <div className="max-w-48">{picker("faviconId", "Favicon", "1/1", "Persegi, minimal 64 px. PNG atau SVG.")}</div>
    </SectionForm>
  );
}

// ===== Header =====

const headerSchema = z
  .object({
    ctaLabel: text("Label tombol", 40),
    ctaHref: z.string().trim().max(500).refine((href) => href === "" || hrefPattern.test(href), {
      error: "Tautan harus diawali / (mis. /jadwal) atau http(s)://.",
    }),
  })
  .refine((value) => (value.ctaLabel === "") === (value.ctaHref === ""), {
    error: "Isi label dan tautan tombol sekaligus, atau kosongkan keduanya.",
    path: ["ctaHref"],
  });

function HeaderSection({ value, onDirtyChange }: SectionProps<"site.header">) {
  const { form, formId, onSubmit, saveBar } = useSettingForm("site.header", headerSchema, value, onDirtyChange);
  const errors = form.formState.errors;
  return (
    <SectionForm id={formId} onSubmit={onSubmit} saveBar={saveBar}>
      <p className="text-small text-fg-muted">Tombol ajakan di kanan menu header. Kosongkan untuk menyembunyikan.</p>
      <FormField id={`${formId}-label`} label="Label tombol" error={errors.ctaLabel?.message}>
        <Input {...form.register("ctaLabel")} placeholder="Konsultasi gratis" />
      </FormField>
      <FormField
        id={`${formId}-href`}
        label="Tautan tombol"
        description="Path internal (/jadwal) atau URL lengkap (https://...)."
        error={errors.ctaHref?.message}
      >
        <Input {...form.register("ctaHref")} placeholder="/jadwal" />
      </FormField>
    </SectionForm>
  );
}

// ===== Kontak =====

const contactSchema = z.object({
  phone: text("Telepon", 30).refine((v) => v === "" || /^[+\d][\d\s().-]*$/.test(v), {
    error: "Nomor telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung.",
  }),
  email: z.string().trim().max(200).refine((v) => v === "" || z.email().safeParse(v).success, {
    error: "Format email tidak valid.",
  }),
  whatsapp: text("WhatsApp", 30).refine((v) => v === "" || /^[+\d][\d\s().-]*$/.test(v), {
    error: "Nomor WhatsApp hanya boleh berisi angka, spasi, +, -, dan tanda kurung.",
  }),
  address: text("Alamat", 500),
  mapEmbedUrl: z.string().trim().max(2000).refine((v) => v === "" || v.startsWith("https://"), {
    error: "Tempel URL embed (https://...), bukan kode <iframe>.",
  }),
});

function ContactSection({ value, onDirtyChange }: SectionProps<"site.contact">) {
  const { form, formId, onSubmit, saveBar } = useSettingForm("site.contact", contactSchema, value, onDirtyChange);
  const errors = form.formState.errors;
  return (
    <SectionForm id={formId} onSubmit={onSubmit} saveBar={saveBar}>
      <div className="grid gap-6 sm:grid-cols-2">
        <FormField id={`${formId}-phone`} label="Telepon" error={errors.phone?.message}>
          <Input type="tel" {...form.register("phone")} placeholder="+62 21 1234 5678" />
        </FormField>
        <FormField
          id={`${formId}-whatsapp`}
          label="WhatsApp"
          description="Dipakai tombol Chat WA. Disimpan dalam format 62..."
          error={errors.whatsapp?.message}
        >
          <Input type="tel" {...form.register("whatsapp")} placeholder="+62 812 3456 7890" />
        </FormField>
      </div>
      <FormField id={`${formId}-email`} label="Email" error={errors.email?.message}>
        <Input type="email" {...form.register("email")} placeholder="halo@contoh.com" />
      </FormField>
      <FormField id={`${formId}-address`} label="Alamat" error={errors.address?.message}>
        <Textarea rows={3} {...form.register("address")} />
      </FormField>
      <FormField
        id={`${formId}-map`}
        label="URL embed peta"
        description="Google Maps: Bagikan → Sematkan peta → salin isi atribut src saja (https://www.google.com/maps/embed?...). OpenStreetMap juga didukung."
        error={errors.mapEmbedUrl?.message}
      >
        <Input {...form.register("mapEmbedUrl")} placeholder="https://www.google.com/maps/embed?pb=..." />
      </FormField>
    </SectionForm>
  );
}

// ===== Sosial media =====

const SOCIAL_OPTIONS: { value: SocialPlatform; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "x", label: "X" },
  { value: "other", label: "Lainnya" },
];

const socialSchema = z.object({
  links: z
    .array(
      z.object({
        platform: z.enum(["instagram", "facebook", "linkedin", "youtube", "tiktok", "x", "other"]),
        label: text("Label", 40),
        url: z.string().trim().regex(/^https?:\/\/\S+$/, { error: "URL harus diawali http:// atau https://." }),
      }),
    )
    .max(12, { error: "Maksimal 12 tautan." }),
});

function SocialSection({ value, onDirtyChange }: SectionProps<"site.social">) {
  const { form, formId, onSubmit, saveBar } = useSettingForm("site.social", socialSchema, value, onDirtyChange);
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "links" });
  const errors = form.formState.errors;

  return (
    <SectionForm id={formId} onSubmit={onSubmit} saveBar={saveBar}>
      {fields.length === 0 ? (
        <p className="text-small text-fg-muted">Belum ada tautan sosial media.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {fields.map((field, index) => (
            <li key={field.id} className="grid gap-3 py-4 sm:grid-cols-[160px_1fr_auto] sm:items-start">
              <Controller
                control={form.control}
                name={`links.${index}.platform`}
                render={({ field: platform }) => (
                  <div className="space-y-2">
                    <Label htmlFor={`${formId}-platform-${index}`}>Platform</Label>
                    <Select value={platform.value} onValueChange={platform.onChange}>
                      <SelectTrigger id={`${formId}-platform-${index}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <div className="space-y-3">
                <FormField id={`${formId}-url-${index}`} label="URL" error={errors.links?.[index]?.url?.message}>
                  <Input {...form.register(`links.${index}.url`)} placeholder="https://" />
                </FormField>
                <FormField
                  id={`${formId}-label-${index}`}
                  label="Label (opsional)"
                  error={errors.links?.[index]?.label?.message}
                >
                  <Input {...form.register(`links.${index}.label`)} />
                </FormField>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:mt-7"
                aria-label={`Hapus tautan ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2Icon strokeWidth={1.5} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {errors.links?.root?.message ? (
        <p className="text-small text-status-error">{errors.links.root.message}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={fields.length >= 12}
        onClick={() => append({ platform: "instagram", label: "", url: "" })}
      >
        <PlusIcon aria-hidden />
        Tambah tautan
      </Button>
    </SectionForm>
  );
}

// ===== Footer =====

const footerSchema = z.object({
  description: text("Deskripsi footer", 500),
  copyright: text("Teks hak cipta", 200),
});

function FooterSection({ value, onDirtyChange }: SectionProps<"site.footer">) {
  const { form, formId, onSubmit, saveBar } = useSettingForm("site.footer", footerSchema, value, onDirtyChange);
  const errors = form.formState.errors;
  return (
    <SectionForm id={formId} onSubmit={onSubmit} saveBar={saveBar}>
      <FormField id={`${formId}-description`} label="Deskripsi singkat" error={errors.description?.message}>
        <Textarea rows={3} {...form.register("description")} />
      </FormField>
      <FormField
        id={`${formId}-copyright`}
        label="Teks hak cipta"
        description="Tahun ditambahkan otomatis, mis. © 2026 [teks ini]."
        error={errors.copyright?.message}
      >
        <Input {...form.register("copyright")} />
      </FormField>
    </SectionForm>
  );
}

// ===== Default pelatihan =====

const requiredItem = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} tidak boleh kosong.` })
    .max(max, { error: `${label} maksimal ${max} karakter.` });

const trainingDefaultsSchema = z.object({
  facilities: z.array(requiredItem("Fasilitas", FACILITY_MAX)).max(FACILITIES_MAX),
  faq: z.array(z.object({ q: requiredItem("Pertanyaan", FAQ_Q_MAX), a: requiredItem("Jawaban", FAQ_A_MAX) })),
  inHouseNote: text("Catatan in-house", 500),
  disclaimer: text("Disclaimer", 500),
});

function TrainingDefaultsSection({ value, onDirtyChange }: SectionProps<"training.defaults">) {
  const { form, formId, onSubmit, saveBar } = useSettingForm(
    "training.defaults",
    trainingDefaultsSchema,
    value,
    onDirtyChange,
  );
  const errors = form.formState.errors;
  return (
    <SectionForm id={formId} onSubmit={onSubmit} saveBar={saveBar}>
      <p className="text-small text-fg-muted">Dipakai di semua halaman detail pelatihan.</p>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Fasilitas default</legend>
        <p className="text-small text-fg-muted">Tampil untuk pelatihan yang memakai fasilitas default.</p>
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
              emptyText="Belum ada fasilitas default."
            />
          )}
        />
      </fieldset>
      <fieldset className="space-y-3 border-t border-border pt-6">
        <legend className="text-sm font-medium">FAQ umum</legend>
        <p className="text-small text-fg-muted">Tampil setelah FAQ khusus tiap pelatihan.</p>
        <Controller
          control={form.control}
          name="faq"
          render={({ field }) => (
            <FaqEditor value={field.value} onChange={field.onChange} errors={errors.faq} emptyText="Belum ada FAQ umum." />
          )}
        />
      </fieldset>
      <FormField
        id={`${formId}-inhouse`}
        label="Catatan in-house"
        description="Tampil di bagian Jadwal & investasi, termasuk saat belum ada jadwal."
        error={errors.inHouseNote?.message}
      >
        <Textarea rows={3} {...form.register("inHouseNote")} />
      </FormField>
      <FormField
        id={`${formId}-disclaimer`}
        label="Disclaimer"
        description="Teks kecil di akhir halaman detail pelatihan."
        error={errors.disclaimer?.message}
      >
        <Textarea rows={3} {...form.register("disclaimer")} />
      </FormField>
    </SectionForm>
  );
}

// ===== SEO default =====

const seoSchema = z.object({
  titleTemplate: text("Template judul", 100).refine((v) => v.includes("%s"), {
    error: "Template judul wajib berisi %s sebagai tempat judul halaman.",
  }),
  defaultTitle: text("Judul default", 70),
  description: text("Deskripsi default", 160),
  ogImageId: z.string().nullable(),
});

function SeoSection({ value, media, onDirtyChange }: SectionProps<"seo.default">) {
  const { form, formId, onSubmit, saveBar } = useSettingForm("seo.default", seoSchema, value, onDirtyChange);
  return <SeoFields form={form} formId={formId} onSubmit={onSubmit} saveBar={saveBar} media={media} />;
}

function SeoFields({
  form,
  formId,
  onSubmit,
  saveBar,
  media,
}: {
  form: UseFormReturn<z.infer<typeof seoSchema>>;
  formId: string;
  onSubmit: () => void;
  saveBar: ReactNode;
  media: AdminSettings["media"];
}) {
  const errors = form.formState.errors;
  const description = useWatch({ control: form.control, name: "description" }) ?? "";
  return (
    <SectionForm id={formId} onSubmit={onSubmit} saveBar={saveBar}>
      <FormField
        id={`${formId}-template`}
        label="Template judul"
        description="%s diganti judul halaman. Contoh: %s | Nama Situs."
        error={errors.titleTemplate?.message}
      >
        <Input {...form.register("titleTemplate")} />
      </FormField>
      <FormField
        id={`${formId}-title`}
        label="Judul default"
        description="Dipakai di halaman yang tidak punya judul sendiri. Kosong = nama situs."
        error={errors.defaultTitle?.message}
      >
        <Input {...form.register("defaultTitle")} />
      </FormField>
      <FormField
        id={`${formId}-description`}
        label="Deskripsi default"
        description={`${description.length}/160 karakter.`}
        error={errors.description?.message}
      >
        <Textarea rows={3} {...form.register("description")} />
      </FormField>
      <Controller
        control={form.control}
        name="ogImageId"
        render={({ field, fieldState }) => (
          <FormField
            id={`${formId}-og`}
            label="Gambar OG default"
            description="Tampil saat tautan dibagikan, kalau halaman tidak punya gambar sendiri. Ideal 1200×630."
            error={fieldState.error?.message}
          >
            <div className="max-w-sm">
              <MediaPicker
                value={field.value}
                onChange={field.onChange}
                initialMedia={field.value ? media[field.value] : null}
                aspect="16/9"
                dialogTitle="Pilih gambar OG"
              />
            </div>
          </FormField>
        )}
      />
    </SectionForm>
  );
}
