"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LockIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { BlocksEditor } from "@/components/admin/page-blocks/blocks-editor";
import { PreviewButton } from "@/components/admin/preview-button";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, SeoPanel } from "@/components/admin/seo-panel";
import { SlugField } from "@/components/admin/slug-field";
import { PublicStateLabel } from "@/components/admin/status-dot";
import { StatusField } from "@/components/admin/status-field";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { useDeleteWithUndo } from "@/hooks/use-delete-with-undo";
import { useScopedId } from "@/hooks/use-scoped-id";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { resourceKeys } from "@/lib/admin-resources";
import { apiSend, errorMessage } from "@/lib/api/client";
import type { Page, PageBlock } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";
import { pageBlocksFormSchema } from "@/lib/page-blocks";

export const pageKeys = resourceKeys("pages");

export function pagePreviewHref(id: string) {
  return `/admin/preview?type=page&id=${id}`;
}

// Path publik: halaman profil punya route sendiri.
export function pagePath(page: Pick<Page, "kind" | "slug">): string {
  return page.kind === "PROFILE" ? "/profil" : `/${page.slug}`;
}

const schema = z.object({
  title: z.string().trim().min(1, { error: "Judul wajib diisi." }).max(200, { error: "Judul maksimal 200 karakter." }),
  slug: z.string().trim().max(120, { error: "Slug maksimal 120 karakter." }),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  blocks: pageBlocksFormSchema,
  seo: z.object({
    title: z.string().trim().max(SEO_TITLE_MAX, { error: `Judul SEO maksimal ${SEO_TITLE_MAX} karakter.` }),
    description: z
      .string()
      .trim()
      .max(SEO_DESCRIPTION_MAX, { error: `Deskripsi SEO maksimal ${SEO_DESCRIPTION_MAX} karakter.` }),
    ogImageId: z.string().nullable(),
  }),
});
// Input form (sebelum trim/transform Zod) dan hasil validasi bisa berbeda tipe.
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;
const FIELD_NAMES = Object.keys(schema.shape);

function toFormValues(page: Page | null): FormInput {
  return {
    title: page?.title ?? "",
    slug: page?.slug ?? "",
    status: page?.status ?? "DRAFT",
    blocks: (page?.blocks ?? []) as FormInput["blocks"],
    seo: page?.seo ?? { title: "", description: "", ogImageId: null },
  };
}

export function PageForm({ page }: { page: Page | null }) {
  const sid = useScopedId("page");
  const formId = sid("form");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [autoSlug, setAutoSlug] = useState(page === null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Bertambah setiap simpan gagal; editor blok membuka & menampilkan blok yang bermasalah.
  const [errorSignal, setErrorSignal] = useState(0);
  const system = page?.kind === "PROFILE";

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(page),
    mode: "onBlur",
  });
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);
  const errors = form.formState.errors;
  const title = useWatch({ control: form.control, name: "title" });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const body = {
        title: values.title,
        // Slug otomatis (form baru, belum diedit) tidak dikirim: BE membuat slug unik sendiri.
        // Halaman profil: slug tidak dikirim sama sekali (terkunci).
        slug: system || (autoSlug && !page) ? undefined : values.slug || undefined,
        status: values.status,
        blocks: values.blocks,
        seo: values.seo,
      };
      return page
        ? (await apiSend<Page>(`/admin/pages/${page.id}`, "PATCH", body)).data
        : (await apiSend<Page>("/admin/pages", "POST", body)).data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all });
      queryClient.setQueryData(pageKeys.detail(saved.id), saved);
      form.reset(toFormValues(saved));
      setAutoSlug(false);
      toast.success(
        saved.status === "PUBLISHED"
          ? "Halaman disimpan dan tayang. Situs diperbarui dalam beberapa detik."
          : "Halaman disimpan sebagai draf.",
      );
      if (!page) router.push(`/admin/pages/${saved.id}`);
    },
    onError: (error) => {
      // Error blok (blocks.N.field) dipasang ke kartu blok yang sesuai.
      if (!applyFieldErrors(error, form.setError, FIELD_NAMES)) toast.error(errorMessage(error));
      setErrorSignal((current) => current + 1);
    },
  });

  const remove = useDeleteWithUndo({
    basePath: "/admin/pages",
    invalidateKey: pageKeys.all,
    noun: "Halaman",
    onDeleted: () => {
      if (page) queryClient.removeQueries({ queryKey: pageKeys.detail(page.id) });
      form.reset();
      router.push("/admin/pages");
    },
  });

  return (
    <>
      <form
        id={formId}
        noValidate
        onSubmit={form.handleSubmit(
          (values) => save.mutate(values),
          () => setErrorSignal((current) => current + 1),
        )}
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0 space-y-6">
          <FormField id={sid("title")} label="Judul" required error={errors.title?.message}>
            <Input {...form.register("title")} />
          </FormField>
          {system ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Alamat</p>
              <p className="flex items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2 font-mono text-sm text-fg-muted">
                <LockIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
                /profil
              </p>
              <p className="text-small text-fg-muted">Halaman sistem: alamatnya tetap dan tidak bisa diubah.</p>
            </div>
          ) : (
            <Controller
              control={form.control}
              name="slug"
              render={({ field }) => (
                <SlugField
                  id={sid("slug")}
                  entity="page"
                  value={field.value}
                  onChange={field.onChange}
                  source={title}
                  auto={autoSlug}
                  onAutoChange={setAutoSlug}
                  excludeId={page?.id}
                  prefix="/"
                  error={errors.slug?.message}
                  publishedSlug={page?.status === "PUBLISHED" ? page.slug : null}
                />
              )}
            />
          )}

          <section className="space-y-4 border-t border-border pt-6" aria-labelledby={sid("blocks-title")}>
            <div>
              <h2 id={sid("blocks-title")} className="text-sm font-medium">
                Blok konten
              </h2>
              <p className="mt-1 text-small text-fg-muted">
                Urutan blok di sini sama dengan urutan di halaman. Seret grip atau pakai Spasi + panah.
              </p>
            </div>
            <Controller
              control={form.control}
              name="blocks"
              render={({ field }) => (
                <BlocksEditor
                  value={field.value as PageBlock[]}
                  onChange={(blocks) => field.onChange(blocks)}
                  errors={errors.blocks}
                  errorSignal={errorSignal}
                  onStructureChange={() => form.clearErrors("blocks")}
                  media={page?.media ?? {}}
                />
              )}
            />
          </section>
        </div>

        <aside className="space-y-8 lg:border-l lg:border-border lg:pl-8">
          <PanelSection title="Publikasi" extra={page ? <PublicStateLabel state={page.status} /> : null}>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => <StatusField name={sid("status")} value={field.value} onChange={field.onChange} />}
            />
          </PanelSection>

          <PanelSection title="SEO">
            <Controller
              control={form.control}
              name="seo"
              render={({ field }) => (
                <SeoPanel
                  value={field.value}
                  onChange={field.onChange}
                  fallbackTitle={title}
                  ogImage={page?.ogImage}
                  errors={{
                    title: errors.seo?.title?.message,
                    description: errors.seo?.description?.message,
                    ogImageId: errors.seo?.ogImageId?.message,
                  }}
                />
              )}
            />
          </PanelSection>

          {page ? (
            <PanelSection title="Lainnya">
              {system ? (
                <p className="text-small text-fg-muted">Halaman sistem tidak bisa dihapus.</p>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-status-error"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2Icon aria-hidden />
                  Hapus halaman
                </Button>
              )}
            </PanelSection>
          ) : null}
        </aside>
      </form>

      <StickySaveBar
        formId={formId}
        dirty={dirty}
        pending={save.isPending}
        onReset={() => form.reset()}
        extra={page ? <PreviewButton href={pagePreviewHref(page.id)} disabled={dirty} /> : null}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus halaman "${page?.title ?? ""}"?`}
        description="Halaman dipindahkan ke Sampah dan hilang dari situs. Bisa dipulihkan dalam 30 hari."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          page && remove.mutate({ id: page.id, label: page.title }, { onSettled: () => setConfirmDelete(false) })
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
