"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, FormProvider, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { FormField } from "@/components/admin/form-field";
import { PreviewButton } from "@/components/admin/preview-button";
import { StickySaveBar } from "@/components/admin/sticky-save-bar";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { useDeleteWithUndo } from "@/hooks/use-delete-with-undo";
import { useScopedId } from "@/hooks/use-scoped-id";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { apiSend, errorMessage } from "@/lib/api/client";
import type { HomeSection, HomeSectionType } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";
import { defaultContent, HOME_SECTION_LABELS, sectionFormSchema } from "@/lib/home-sections";
import { HOME_PREVIEW_HREF } from "./home-builder";
import { homeKeys } from "./home-keys";
import { SectionFields, type SectionFormValues } from "./section-fields";

function toFormValues(type: HomeSectionType, section: HomeSection | null): SectionFormValues {
  return {
    title: section?.title ?? "",
    visible: section?.visible ?? true,
    // Isi tersimpan yang sudah tidak valid (content null) diganti isi awal supaya bisa diisi ulang.
    content: (section?.content ?? defaultContent(type)) as Record<string, unknown>,
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SectionForm({ type, section }: { type: HomeSectionType; section: HomeSection | null }) {
  const sid = useScopedId("section");
  const formId = sid("form");
  const router = useRouter();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Bertambah setiap simpan gagal: scroll ke error pertama (termasuk baris content.items.N).
  const [errorSignal, setErrorSignal] = useState(0);

  const form = useForm<SectionFormValues>({
    // Skema dipilih per type saat runtime, sedangkan tipe nilai form generik (content per type);
    // TS tidak bisa menghubungkan keduanya, jadi resolver dipersempit di sini.
    resolver: zodResolver(sectionFormSchema(type)) as unknown as Resolver<SectionFormValues>,
    defaultValues: toFormValues(type, section),
    mode: "onBlur",
  });
  const dirty = form.formState.isDirty;
  useUnsavedChangesGuard(dirty);

  useEffect(() => {
    if (errorSignal === 0) return;
    const target = formRef.current?.querySelector<HTMLElement>("[aria-invalid=true], [role=alert]");
    target?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [errorSignal]);

  const save = useMutation({
    mutationFn: async (values: SectionFormValues) => {
      const title = values.title || null;
      return section
        ? (await apiSend<HomeSection>(`/admin/home-sections/${section.id}`, "PATCH", { ...values, title })).data
        : (await apiSend<HomeSection>("/admin/home-sections", "POST", { type, ...values, title })).data;
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: homeKeys.all });
      queryClient.setQueryData(homeKeys.detail(saved.id), saved);
      form.reset(toFormValues(type, saved));
      toast.success(
        saved.visible ? "Section disimpan. Beranda diperbarui dalam beberapa detik." : "Section disimpan (tersembunyi).",
      );
      if (!section) router.push(`/admin/home/${saved.id}`);
    },
    onError: (error) => {
      // Error isi (content.items.1.label) dipasang ke field/baris yang sesuai.
      if (!applyFieldErrors(error, form.setError, ["title", "visible", "content"])) toast.error(errorMessage(error));
      setErrorSignal((current) => current + 1);
    },
  });

  const remove = useDeleteWithUndo({
    basePath: "/admin/home-sections",
    invalidateKey: homeKeys.all,
    noun: "Section",
    onDeleted: () => {
      if (section) queryClient.removeQueries({ queryKey: homeKeys.detail(section.id) });
      form.reset();
      router.push("/admin/home");
    },
  });

  return (
    <FormProvider {...form}>
      <form
        ref={formRef}
        id={formId}
        noValidate
        onSubmit={form.handleSubmit(
          (values) => save.mutate(values),
          () => setErrorSignal((current) => current + 1),
        )}
        className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]"
      >
        <div className="min-w-0">
          <SectionFields type={type} media={section?.media ?? {}} />
        </div>

        <aside className="space-y-6 lg:border-l lg:border-border lg:pl-8">
          <section className="space-y-4">
            <h2 className="font-mono text-label uppercase text-fg-muted">Section</h2>
            <p className="text-sm">
              Tipe: <span className="font-medium text-fg-strong">{HOME_SECTION_LABELS[type]}</span>
            </p>
            <FormField
              id={sid("title")}
              label="Label internal"
              description="Hanya tampil di admin, mis. Hero utama."
              error={form.formState.errors.title?.message}
            >
              <Input {...form.register("title")} />
            </FormField>
            <Controller
              control={form.control}
              name="visible"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Switch
                    id={sid("visible")}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-describedby={sid("visible-help")}
                  />
                  <div>
                    <Label htmlFor={sid("visible")}>Tampil di beranda</Label>
                    <p id={sid("visible-help")} className="mt-1 text-small text-fg-muted">
                      Section tersembunyi tetap terlihat di pratinjau.
                    </p>
                  </div>
                </div>
              )}
            />
            {/* Elemen grafis per section (DESIGN.md 6.2): garis, pola titik, teks outline, dsb. */}
            <Controller
              control={form.control}
              name="content.decor"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Switch
                    id={sid("decor")}
                    checked={field.value !== false}
                    onCheckedChange={field.onChange}
                    aria-describedby={sid("decor-help")}
                  />
                  <div>
                    <Label htmlFor={sid("decor")}>Elemen dekoratif</Label>
                    <p id={sid("decor-help")} className="mt-1 text-small text-fg-muted">
                      Hiasan grafis section ini (pola titik, tanda +, teks outline, bingkai). Isi tidak berubah.
                    </p>
                  </div>
                </div>
              )}
            />
          </section>
          {section ? (
            <section className="border-t border-border pt-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-status-error"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon aria-hidden />
                Hapus section
              </Button>
            </section>
          ) : null}
        </aside>
      </form>

      <StickySaveBar
        formId={formId}
        dirty={dirty}
        pending={save.isPending}
        onReset={() => form.reset()}
        extra={section ? <PreviewButton href={HOME_PREVIEW_HREF} disabled={dirty} /> : null}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus section "${HOME_SECTION_LABELS[type]}"?`}
        description="Section dipindahkan ke Sampah dan hilang dari beranda. Bisa dipulihkan dalam 30 hari."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          section &&
          remove.mutate({ id: section.id, label: HOME_SECTION_LABELS[type] }, { onSettled: () => setConfirmDelete(false) })
        }
      />
    </FormProvider>
  );
}
