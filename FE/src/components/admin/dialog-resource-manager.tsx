"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpDownIcon, PencilIcon, PlusIcon, Trash2Icon, type LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { createDataTableColumns, type DataTableColumn } from "@/components/admin/data-table";
import { OptionRow } from "@/components/admin/option-row";
import { PageHeader } from "@/components/admin/page-header";
import { ReorderPanel } from "@/components/admin/reorder-panel";
import { ResourceTable } from "@/components/admin/resource-table";
import { Button } from "@/components/admin/ui/button";
import { useDeleteWithUndo } from "@/hooks/use-delete-with-undo";
import { loadReorderOptions, resourceKeys, type AdminResource } from "@/lib/admin-resources";
import { apiFetch } from "@/lib/api/client";
import type { OptionItem } from "@/lib/api/types";

type DialogResourceManagerProps<TItem extends { id: string }> = {
  resource: AdminResource;
  title: string;
  description: string;
  // Kata benda: huruf kecil untuk kalimat, kapital untuk awal pesan (mis. "klien" / "Klien").
  noun: string;
  nounTitle: string;
  icon: LucideIcon;
  columns: DataTableColumn<TItem>[];
  rowLabel: (row: TItem) => string;
  sorts: readonly { value: string; label: string }[];
  searchPlaceholder: string;
  emptyDescription: string;
  deleteDescription: string;
  params?: Record<string, string>;
  filters?: ReactNode;
  // Form tambah (item null) / ubah dalam dialog; dipanggil hanya saat dialog terbuka.
  renderDialog: (props: { item: TItem | null; onClose: () => void }) => ReactNode;
};

type DialogState<TItem> = { item: TItem | null } | null;

// Halaman admin untuk entitas sederhana yang diedit lewat dialog (klien, testimoni, kontak
// marketing): tabel + mode urutkan + tambah/ubah di dialog + hapus dengan
// konfirmasi dan "Urungkan" (pulihkan). ?edit=<id> membuka dialog ubah item itu (search global).
export function DialogResourceManager<TItem extends { id: string }>({
  resource,
  title,
  description,
  noun,
  nounTitle,
  icon,
  columns,
  rowLabel,
  sorts,
  searchPlaceholder,
  emptyDescription,
  deleteDescription,
  params,
  filters,
  renderDialog,
}: DialogResourceManagerProps<TItem>) {
  const keys = resourceKeys(resource);
  const [reordering, setReordering] = useState(false);
  const [dialog, setDialog] = useState<DialogState<TItem>>(null);
  const [deleting, setDeleting] = useState<TItem | null>(null);
  const remove = useDeleteWithUndo({ basePath: `/admin/${resource}`, invalidateKey: keys.all, noun: nounTitle });

  const allColumns = useMemo(() => {
    const helper = createDataTableColumns<TItem>();
    return helper.columns([
      ...columns,
      helper.display({
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Ubah ${rowLabel(row.original)}`}
              onClick={() => setDialog({ item: row.original })}
            >
              <PencilIcon strokeWidth={1.5} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Hapus ${rowLabel(row.original)}`}
              onClick={() => setDeleting(row.original)}
            >
              <Trash2Icon strokeWidth={1.5} aria-hidden />
            </Button>
          </div>
        ),
      }),
    ]);
  }, [columns, rowLabel]);

  const addButton = (
    <Button onClick={() => setDialog({ item: null })}>
      <PlusIcon aria-hidden />
      Tambah {noun}
    </Button>
  );

  return (
    <>
      <PageHeader title={title} description={description} actions={addButton} />
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant={reordering ? "default" : "outline"} onClick={() => setReordering((current) => !current)}>
            <ArrowUpDownIcon aria-hidden />
            {reordering ? "Selesai mengurutkan" : "Urutkan"}
          </Button>
        </div>
        {reordering ? (
          <ReorderPanel<OptionItem>
            queryKey={keys.reorder}
            load={() => loadReorderOptions(resource)}
            reorderPath={`/admin/${resource}/reorder`}
            invalidateKey={keys.all}
            itemLabel={(item) => item.label}
            noun={noun}
            emptyIcon={icon}
            renderItem={(item) => <OptionRow item={item} />}
          />
        ) : (
          <ResourceTable<TItem>
            resource={resource}
            columns={allColumns}
            rowLabel={rowLabel}
            sorts={sorts}
            searchPlaceholder={searchPlaceholder}
            unit={noun}
            params={params}
            filters={filters}
            empty={{ icon, title: `Belum ada ${noun}`, description: emptyDescription, action: addButton }}
          />
        )}
      </div>

      {dialog ? renderDialog({ item: dialog.item, onClose: () => setDialog(null) }) : null}
      {/* useSearchParams butuh Suspense. */}
      <Suspense fallback={null}>
        {dialog ? null : <EditFromUrl<TItem> resource={resource} nounTitle={nounTitle} renderDialog={renderDialog} />}
      </Suspense>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title={`Hapus ${noun} "${deleting ? rowLabel(deleting) : ""}"?`}
        description={deleteDescription}
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate({ id: deleting.id, label: rowLabel(deleting) }, { onSettled: () => setDeleting(null) })
        }
      />
    </>
  );
}

// Dialog ubah untuk ?edit=<id>: item diambil per id (belum tentu ada di halaman tabel yang tampil).
// Menutup dialog atau item yang tidak ditemukan menghapus parameter dari URL.
function EditFromUrl<TItem extends { id: string }>({
  resource,
  nounTitle,
  renderDialog,
}: {
  resource: AdminResource;
  nounTitle: string;
  renderDialog: DialogResourceManagerProps<TItem>["renderDialog"];
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const editId = searchParams.get("edit");
  const item = useQuery({
    queryKey: [...resourceKeys(resource).detail(editId ?? ""), "edit"],
    queryFn: async () => (await apiFetch<TItem>(`/admin/${resource}/${editId}`)).data,
    enabled: Boolean(editId),
    retry: false,
  });

  useEffect(() => {
    if (!editId || !item.isError) return;
    toast.error(`${nounTitle} tidak ditemukan atau sudah dihapus.`);
    router.replace(pathname, { scroll: false });
  }, [editId, item.isError, nounTitle, pathname, router]);

  if (!editId || !item.data || item.data.id !== editId) return null;
  return renderDialog({ item: item.data, onClose: () => router.replace(pathname, { scroll: false }) });
}
