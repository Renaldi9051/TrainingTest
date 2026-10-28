"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeIcon, EyeOffIcon, HouseIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { SortableList } from "@/components/admin/sortable-list";
import { TableSkeleton } from "@/components/admin/table-skeleton";
import { Button } from "@/components/admin/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Switch } from "@/components/admin/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/admin/ui/tooltip";
import { useDeleteWithUndo } from "@/hooks/use-delete-with-undo";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { HomeSection } from "@/lib/api/types";
import {
  ADDABLE_HOME_SECTION_TYPES,
  HOME_SECTION_DESCRIPTIONS,
  HOME_SECTION_LABELS,
  isRetiredHomeSectionType,
  sectionSummary,
  unavailableTypes,
} from "@/lib/home-sections";
import { cn } from "@/lib/utils";
import { homeKeys } from "./home-keys";

export const HOME_PREVIEW_HREF = "/admin/preview?type=home";

// Builder beranda: urutan (drag & drop / keyboard) dan toggle tampil langsung tersimpan
// (optimistic); gagal = kembali ke keadaan sebelumnya + toast.
export function HomeBuilder() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<HomeSection | null>(null);
  const query = useQuery({
    queryKey: homeKeys.list,
    queryFn: async () => (await apiFetch<HomeSection[]>("/admin/home-sections")).data,
  });

  // Ubah cache dulu, simpan ke BE; gagal = kembalikan snapshot.
  async function optimistic(update: (sections: HomeSection[]) => HomeSection[]) {
    await queryClient.cancelQueries({ queryKey: homeKeys.list });
    const previous = queryClient.getQueryData<HomeSection[]>(homeKeys.list);
    queryClient.setQueryData<HomeSection[]>(homeKeys.list, (current) => (current ? update(current) : current));
    return { previous };
  }

  const toggle = useMutation({
    mutationFn: async ({ id, visible }: { id: string; visible: boolean }) =>
      apiSend(`/admin/home-sections/${id}`, "PATCH", { visible }),
    onMutate: ({ id, visible }) =>
      optimistic((sections) => sections.map((section) => (section.id === id ? { ...section, visible } : section))),
    onError: (error, { visible }, context) => {
      if (context?.previous) queryClient.setQueryData(homeKeys.list, context.previous);
      toast.error(errorMessage(error, visible ? "Section gagal ditampilkan." : "Section gagal disembunyikan."));
    },
    onSuccess: (_data, { visible }) => toast.success(visible ? "Section ditampilkan di beranda." : "Section disembunyikan."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: homeKeys.list }),
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => apiSend("/admin/home-sections/reorder", "POST", { ids }),
    onMutate: (ids) =>
      optimistic((sections) =>
        ids.flatMap((id) => sections.find((section) => section.id === id) ?? []),
      ),
    onError: (error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(homeKeys.list, context.previous);
      toast.error(errorMessage(error, "Urutan gagal disimpan."));
    },
    onSuccess: () => toast.success("Urutan section disimpan."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: homeKeys.list }),
  });

  const remove = useDeleteWithUndo({ basePath: "/admin/home-sections", invalidateKey: homeKeys.all, noun: "Section" });

  const sections = query.data ?? [];
  const unavailable = unavailableTypes(sections);

  const addMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button disabled={query.isPending}>
          <PlusIcon aria-hidden />
          Tambah section
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {ADDABLE_HOME_SECTION_TYPES.map((type) => {
          const reason = unavailable[type];
          const item = (
            <DropdownMenuItem
              disabled={Boolean(reason)}
              onSelect={() => router.push(`/admin/home/new?type=${type}`)}
              className="flex-col items-start gap-0.5"
            >
              <span className="text-sm font-medium">{HOME_SECTION_LABELS[type]}</span>
              <span className="text-small text-fg-muted">{reason ?? HOME_SECTION_DESCRIPTIONS[type]}</span>
            </DropdownMenuItem>
          );
          // Item nonaktif tidak menerima pointer; tooltip dipasang di pembungkusnya. Alasan juga
          // tertulis di item supaya terbaca tanpa hover.
          return reason ? (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <div>{item}</div>
              </TooltipTrigger>
              <TooltipContent side="left">{reason}</TooltipContent>
            </Tooltip>
          ) : (
            <div key={type}>{item}</div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PageHeader
        title="Beranda"
        description="Susun section beranda. Urutan dan status tampil langsung tersimpan."
        actions={
          <>
            <Button variant="outline" asChild>
              <a href={HOME_PREVIEW_HREF} target="_blank" rel="noreferrer">
                <EyeIcon aria-hidden />
                Pratinjau beranda
                <span className="sr-only">(tab baru)</span>
              </a>
            </Button>
            {addMenu}
          </>
        }
      />

      {query.isPending ? (
        <TableSkeleton rows={8} columns={3} />
      ) : query.isError ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
          <p className="text-small text-status-error">Section beranda tidak dapat dimuat.</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : sections.length === 0 ? (
        <EmptyState
          icon={HouseIcon}
          title="Beranda belum punya section"
          description="Mulai dari Hero, lalu tambahkan section lain sesuai kebutuhan."
          action={addMenu}
        />
      ) : (
        <div className="space-y-3">
          <p className="text-small text-fg-muted">
            Seret grip, atau fokus ke grip lalu tekan Spasi dan panah atas/bawah. Section tersembunyi tidak tampil di
            situs tapi tetap terlihat di pratinjau.
          </p>
          <SortableList
            items={sections}
            itemLabel={(section) => `${HOME_SECTION_LABELS[section.type]}${section.title ? ` (${section.title})` : ""}`}
            disabled={reorder.isPending}
            onReorder={(ids) => reorder.mutate(ids)}
            renderItem={(section, handle) => {
              const index = sections.indexOf(section);
              const label = `${HOME_SECTION_LABELS[section.type]}${section.title ? ` (${section.title})` : ""}`;
              // Type yang dipensiunkan tidak dirender di beranda: toggle tampil tidak berarti, tinggal ubah/hapus.
              const retired = isRetiredHomeSectionType(section.type);
              return (
                <div className={cn("flex items-center gap-3 py-2", (retired || !section.visible) && "opacity-60")}>
                  {handle}
                  <span className="font-mono text-xs text-fg-muted">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-fg-strong">
                      {label}
                      {retired || !section.visible ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-fg-muted">
                          <EyeOffIcon className="size-3" strokeWidth={1.5} aria-hidden />
                          {retired ? "Tidak tampil di beranda" : "Tersembunyi"}
                        </span>
                      ) : null}
                    </p>
                    <p className={cn("truncate text-small", section.content ? "text-fg-muted" : "text-status-warning")}>
                      {sectionSummary(section)}
                    </p>
                  </div>
                  {retired ? null : (
                    <Switch
                      checked={section.visible}
                      onCheckedChange={(visible) => toggle.mutate({ id: section.id, visible })}
                      aria-label={`Tampilkan ${label} di beranda`}
                    />
                  )}
                  <Button variant="ghost" size="icon-sm" asChild>
                    <Link href={`/admin/home/${section.id}`} aria-label={`Ubah ${label}`}>
                      <PencilIcon strokeWidth={1.5} aria-hidden />
                    </Link>
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${label}`} onClick={() => setDeleting(section)}>
                    <Trash2Icon strokeWidth={1.5} aria-hidden />
                  </Button>
                </div>
              );
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title={`Hapus section "${deleting ? HOME_SECTION_LABELS[deleting.type] : ""}"?`}
        description="Section dipindahkan ke Sampah dan hilang dari beranda. Bisa dipulihkan dalam 30 hari."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { id: deleting.id, label: HOME_SECTION_LABELS[deleting.type] },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </>
  );
}
