"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, PencilIcon, PlusIcon, TagsIcon, Trash2Icon, XIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { SortableList } from "@/components/admin/sortable-list";
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
import { Skeleton } from "@/components/admin/ui/skeleton";
import { useScopedId } from "@/hooks/use-scoped-id";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { ArticleCategory } from "@/lib/api/types";
import { articleKeys } from "./article-keys";

const NAME_MAX = 80;

export function ArticleCategoriesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <TagsIcon aria-hidden />
        Kategori artikel
      </Button>
      {open ? <ArticleCategoriesDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

// Kategori artikel sedikit dan sederhana (nama + urutan), jadi dikelola dalam satu dialog.
export function ArticleCategoriesDialog({ onClose }: { onClose: () => void }) {
  const sid = useScopedId("article-categories");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<ArticleCategory | null>(null);

  const query = useQuery({
    queryKey: articleKeys.categories,
    queryFn: async () => (await apiFetch<ArticleCategory[]>("/admin/article-categories")).data,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: articleKeys.categories });
    await queryClient.invalidateQueries({ queryKey: articleKeys.all });
  };

  const create = useMutation({
    mutationFn: async (value: string) =>
      (await apiSend<ArticleCategory>("/admin/article-categories", "POST", { name: value })).data,
    onSuccess: async (created) => {
      await refresh();
      setName("");
      toast.success(`Kategori "${created.name}" ditambahkan.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rename = useMutation({
    mutationFn: async (value: { id: string; name: string }) =>
      (await apiSend<ArticleCategory>(`/admin/article-categories/${value.id}`, "PATCH", { name: value.name })).data,
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      toast.success("Nama kategori disimpan.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiSend(`/admin/article-categories/${id}`, "DELETE"),
    onSuccess: async () => {
      await refresh();
      setDeleting(null);
      toast.success("Kategori dihapus.");
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      setDeleting(null);
    },
  });

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => apiSend("/admin/article-categories/reorder", "POST", { ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: articleKeys.categories });
      const previous = queryClient.getQueryData<ArticleCategory[]>(articleKeys.categories);
      if (previous) {
        const byId = new Map(previous.map((item) => [item.id, item]));
        queryClient.setQueryData(
          articleKeys.categories,
          ids.flatMap((id) => byId.get(id) ?? []),
        );
      }
      return { previous };
    },
    onError: (error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(articleKeys.categories, context.previous);
      toast.error(errorMessage(error));
    },
    onSettled: () => void refresh(),
  });

  function submitNew(event: FormEvent) {
    event.preventDefault();
    const value = name.trim();
    if (value) create.mutate(value);
  }

  const items = query.data ?? [];

  return (
    <>
      <Dialog open onOpenChange={(next) => (!next ? onClose() : undefined)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kategori artikel</DialogTitle>
            <DialogDescription>
              Dipakai sebagai label kartu dan filter di halaman /artikel. Seret grip atau pakai Spasi + panah untuk
              mengubah urutan.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitNew} className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor={sid("new")}>Kategori baru</Label>
              <Input
                id={sid("new")}
                value={name}
                maxLength={NAME_MAX}
                placeholder="Mis. Teknologi"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              <PlusIcon aria-hidden />
              Tambah
            </Button>
          </form>

          {query.isPending ? (
            <div className="space-y-2" role="status" aria-label="Memuat kategori">
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
              <p className="text-small text-status-error">Kategori tidak dapat dimuat.</p>
              <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                Coba lagi
              </Button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={TagsIcon}
              title="Belum ada kategori"
              description="Tambahkan minimal satu kategori sebelum menulis artikel."
            />
          ) : (
            <SortableList
              items={items}
              itemLabel={(item) => item.name}
              disabled={reorder.isPending}
              onReorder={(ids) => reorder.mutate(ids)}
              className="divide-y divide-border border-y border-border"
              renderItem={(item, handle) =>
                editing?.id === item.id ? (
                  <form
                    className="flex items-center gap-2 py-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const value = editing.name.trim();
                      if (value) rename.mutate({ id: item.id, name: value });
                    }}
                  >
                    {handle}
                    <Input
                      aria-label={`Nama baru untuk ${item.name}`}
                      value={editing.name}
                      maxLength={NAME_MAX}
                      autoFocus
                      onChange={(event) => setEditing({ id: item.id, name: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.stopPropagation();
                          setEditing(null);
                        }
                      }}
                    />
                    <Button type="submit" size="icon-sm" aria-label="Simpan nama" disabled={rename.isPending}>
                      <CheckIcon aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Batal" onClick={() => setEditing(null)}>
                      <XIcon aria-hidden />
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 py-2">
                    {handle}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg-strong">{item.name}</p>
                      <p className="font-mono text-xs text-fg-muted">
                        {item.slug} · {item.articleCount} artikel
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Ubah ${item.name}`}
                      onClick={() => setEditing({ id: item.id, name: item.name })}
                    >
                      <PencilIcon aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-status-error"
                      aria-label={`Hapus ${item.name}`}
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2Icon aria-hidden />
                    </Button>
                  </div>
                )
              }
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title={`Hapus kategori "${deleting?.name ?? ""}"?`}
        description={
          deleting && deleting.articleCount > 0
            ? `Kategori ini masih dipakai ${deleting.articleCount} artikel. Pindahkan artikelnya ke kategori lain dulu.`
            : "Kategori dihapus dari daftar dan filter situs."
        }
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.id);
        }}
      />
    </>
  );
}
