"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { IconPicker } from "@/components/admin/icon-picker";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { PreviewButton } from "@/components/admin/preview-button";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, SeoPanel } from "@/components/admin/seo-panel";
import { SlugField } from "@/components/admin/slug-field";
import { PublicStateLabel } from "@/components/admin/status-dot";
import { StatusField } from "@/components/admin/status-field";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Textarea } from "@/components/admin/ui/textarea";
import { useDeleteWithUndo } from "@/hooks/use-delete-with-undo";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { useScopedId } from "@/hooks/use-scoped-id";
import { resourceKeys } from "@/lib/admin-resources";
import { apiSend, errorMessage } from "@/lib/api/client";
import type { RichTextDoc, Service } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";

export const serviceKeys = resourceKeys("services");

export function servicePreviewHref(id: string) {
  return `/admin/preview?type=service&id=${id}`;
}

const SUMMARY_MAX = 300;

const richText = z.custom<RichTextDoc | null>((value) => value === null || typeof value === "object");

const schema = z.object({
  title: z.string().trim().min(1, { error: "Judul wajib diisi." }).max(200, { error: "Judul maksimal 200 karakter." }),
  slug: z.string().trim().max(120, { error: "Slug maksimal 120 karakter." }),
  summary: z.string().trim().max(SUMMARY_MAX, { error: `Ringkasan maksimal ${SUMMARY_MAX} karakter.` }),
  body: richText,
  icon: z.string().nullable(),
  imageId: z.string().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  seo: z.object({
    title: z.string().trim().max(SEO_TITLE_MAX, { error: `Judul SEO maksimal ${SEO_TITLE_MAX} karakter.` }),
    description: z
      .string()
      .trim()
      .max(SEO_DESCRIPTION_MAX, { error: `Deskripsi SEO maksimal ${SEO_DESCRIPTION_MAX} karakter.` }),
    ogImageId: z.string().nullable(),
  }),
});
type FormValues = z.infer<typeof schema>;
const FIELD_NAMES = Object.keys(schema.shape);

function toFormValues(service: Service | null): FormValues {
  return {
    title: service?.title ?? "",
    slug: service?.slug ?? "",
    summary: service?.summary ?? "",
    body: service?.body ?? null,
    icon: service?.icon ?? null,
    imageId: service?.imageId ?? null,
    status: service?.status ?? "DRAFT",
    seo: service?.seo ?? { title: "", description: "", ogImageId: null },
  };
}

export function ServiceForm({ service }: { service: Service | null }) {
  const id = useScopedId("service");
  const formId = id("form");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [autoSlug, setAutoSlug] = useState(service === null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(service), mode: "onBlur" });
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);
  const errors = form.formState.errors;
  const title = useWatch({ control: form.control, name: "title" });
  const summary = useWatch({ control: form.control, name: "summary" });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      // Slug otomatis (belum diedit manual) tidak dikirim: BE membuat slug unik sendiri.
      const body = {
        ...values,
        slug: autoSlug && !service ? undefined : values.slug || undefined,
        summary: values.summary || null,
      };
      return service
        ? (await apiSend<Service>(`/admin/services/${service.id}`, "PATCH", body)).data
        : (await apiSend<Service>("/admin/services", "POST", body)).data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      queryClient.setQueryData(serviceKeys.detail(saved.id), saved);
      form.reset(toFormValues(saved));
      setAutoSlug(false);
      toast.success(
        saved.status === "PUBLISHED"
          ? "Layanan disimpan dan tayang. Situs diperbarui dalam beberapa detik."
          : "Layanan disimpan sebagai draf.",
      );
      if (!service) router.push(`/admin/services/${saved.id}`);
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
    },
  });

  const remove = useDeleteWithUndo({
    basePath: "/admin/services",
    invalidateKey: serviceKeys.all,
    noun: "Layanan",
    onDeleted: () => {
      if (service) queryClient.removeQueries({ queryKey: serviceKeys.detail(service.id) });
      form.reset();
      router.push("/admin/services");
    },
  });

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
          <Controller
            control={form.control}
            name="slug"
            render={({ field }) => (
              <SlugField
                id={id("slug")}
                entity="service"
                value={field.value}
                onChange={field.onChange}
                source={title}
                auto={autoSlug}
                onAutoChange={setAutoSlug}
                excludeId={service?.id}
                prefix="/layanan/"
                error={errors.slug?.message}
                publishedSlug={service?.status === "PUBLISHED" ? service.slug : null}
              />
            )}
          />
          <FormField
            id={id("summary")}
            label="Ringkasan"
            description={`Tampil di daftar layanan dan beranda. ${summary.length}/${SUMMARY_MAX} karakter.`}
            error={errors.summary?.message}
          >
            <Textarea rows={3} {...form.register("summary")} />
          </FormField>
          <Controller
            control={form.control}
            name="body"
            render={({ field, fieldState }) => (
              <FormField id={id("body")} label="Detail" description="Isi halaman detail layanan." error={fieldState.error?.message}>
                <RichTextEditor value={field.value} onChange={field.onChange} onBlur={field.onBlur} aria-label="Detail layanan" />
              </FormField>
            )}
          />
        </div>

        <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
          <PanelSection
            title="Publikasi"
            extra={service ? <PublicStateLabel state={service.status} /> : null}
          >
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => <StatusField name={field.name} value={field.value} onChange={field.onChange} />}
            />
          </PanelSection>

          <Controller
            control={form.control}
            name="imageId"
            render={({ field, fieldState }) => (
              <FormField
                id={id("image")}
                label="Gambar"
                description="Rasio 4:3, wajib punya alt text. Muncul saat baris layanan di beranda di-hover."
                error={fieldState.error?.message}
              >
                <MediaPicker value={field.value} onChange={field.onChange} initialMedia={service?.image} dialogTitle="Pilih gambar layanan" />
              </FormField>
            )}
          />

          <Controller
            control={form.control}
            name="icon"
            render={({ field }) => (
              <IconPicker name={id("icon")} value={field.value} onChange={field.onChange} error={errors.icon?.message} />
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
                  ogImage={service?.ogImage}
                  errors={{
                    title: errors.seo?.title?.message,
                    description: errors.seo?.description?.message,
                    ogImageId: errors.seo?.ogImageId?.message,
                  }}
                />
              )}
            />
          </PanelSection>

          {service ? (
            <PanelSection title="Lainnya">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-status-error"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon aria-hidden />
                Hapus layanan
              </Button>
            </PanelSection>
          ) : null}
        </aside>
      </form>

      <StickySaveBar
        formId={formId}
        dirty={dirty}
        pending={save.isPending}
        onReset={() => form.reset()}
        extra={service ? <PreviewButton href={servicePreviewHref(service.id)} disabled={dirty} /> : null}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus layanan "${service?.title ?? ""}"?`}
        description="Layanan dipindahkan ke Sampah dan hilang dari situs. Bisa dipulihkan dalam 30 hari."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          service &&
          remove.mutate(
            { id: service.id, label: service.title },
            { onSettled: () => setConfirmDelete(false) },
          )
        }
      />
    </>
  );
}

function PanelSection({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-label uppercase text-fg-muted">{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
