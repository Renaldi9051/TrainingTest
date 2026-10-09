"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, MenuIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { FormField } from "@/components/admin/form-field";
import { SortableList } from "@/components/admin/sortable-list";
import { TableSkeleton } from "@/components/admin/table-skeleton";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { AdminNavTree, NavItem, NavLocation } from "@/lib/api/types";
import { applyFieldErrors } from "@/lib/form-errors";

const navKey = ["admin", "nav"] as const;
const NO_PARENT = "__root";

const LOCATIONS: { value: NavLocation; label: string; key: keyof AdminNavTree }[] = [
  { value: "HEADER", label: "Header", key: "header" },
  { value: "FOOTER", label: "Footer", key: "footer" },
];

const locationKey = (location: NavLocation): keyof AdminNavTree =>
  location === "HEADER" ? "header" : "footer";

type DialogState =
  | { mode: "create"; location: NavLocation; parentId: string | null }
  | { mode: "edit"; item: NavItem };

export function NavigationEditor() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: navKey,
    queryFn: async () => (await apiFetch<AdminNavTree>("/admin/nav")).data,
  });
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [deleting, setDeleting] = useState<NavItem | null>(null);

  const reorder = useMutation({
    mutationFn: async (ids: string[]) => apiSend("/admin/nav/reorder", "POST", { ids }),
    onError: (error) => {
      toast.error(errorMessage(error, "Urutan gagal disimpan."));
      void queryClient.invalidateQueries({ queryKey: navKey });
    },
    onSuccess: () => toast.success("Urutan menu disimpan."),
  });

  const remove = useMutation({
    mutationFn: async (item: NavItem) => apiSend(`/admin/nav/${item.id}`, "DELETE"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: navKey });
      setDeleting(null);
      toast.success("Menu dihapus.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Urutan diterapkan langsung di cache (optimistik), lalu disimpan ke BE.
  function applyOrder(location: keyof AdminNavTree, parentId: string | null, ids: string[]) {
    queryClient.setQueryData<AdminNavTree>(navKey, (current) => {
      if (!current) return current;
      const sortBy = (items: NavItem[]) =>
        ids.map((id) => items.find((item) => item.id === id)).filter((item): item is NavItem => Boolean(item));
      const roots = current[location];
      const next = parentId
        ? roots.map((root) => (root.id === parentId ? { ...root, children: sortBy(root.children) } : root))
        : sortBy(roots);
      return { ...current, [location]: next };
    });
    reorder.mutate(ids);
  }

  if (query.isPending) return <TableSkeleton rows={5} columns={3} />;
  if (query.isError) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
        <p className="text-small text-status-error">Menu tidak dapat dimuat.</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="HEADER">
        <TabsList aria-label="Lokasi menu">
          {LOCATIONS.map((location) => (
            <TabsTrigger key={location.value} value={location.value}>
              {location.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {LOCATIONS.map((location) => {
          const items = query.data[location.key];
          return (
            <TabsContent key={location.value} value={location.value} className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setDialog({ mode: "create", location: location.value, parentId: null })}>
                  <PlusIcon aria-hidden />
                  Tambah menu
                </Button>
              </div>
              {items.length === 0 ? (
                <EmptyState
                  icon={MenuIcon}
                  title={`Menu ${location.label.toLowerCase()} masih kosong`}
                  description="Tambahkan tautan ke halaman yang sering dicari pengunjung."
                />
              ) : (
                <SortableList
                  items={items}
                  itemLabel={(item) => item.label}
                  disabled={reorder.isPending}
                  onReorder={(ids) => applyOrder(location.key, null, ids)}
                  renderItem={(item, handle) => (
                    <div>
                      <NavRow
                        item={item}
                        handle={handle}
                        onEdit={() => setDialog({ mode: "edit", item })}
                        onDelete={() => setDeleting(item)}
                        extra={
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDialog({ mode: "create", location: location.value, parentId: item.id })
                            }
                          >
                            <PlusIcon aria-hidden />
                            Submenu
                          </Button>
                        }
                      />
                      {item.children.length > 0 ? (
                        <div className="pb-3 pl-10">
                          <SortableList
                            items={item.children}
                            itemLabel={(child) => child.label}
                            disabled={reorder.isPending}
                            onReorder={(ids) => applyOrder(location.key, item.id, ids)}
                            renderItem={(child, childHandle) => (
                              <NavRow
                                item={child}
                                handle={childHandle}
                                onEdit={() => setDialog({ mode: "edit", item: child })}
                                onDelete={() => setDeleting(child)}
                              />
                            )}
                          />
                        </div>
                      ) : null}
                    </div>
                  )}
                />
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {dialog ? (
        <NavItemDialog
          state={dialog}
          roots={query.data[locationKey(dialog.mode === "create" ? dialog.location : dialog.item.location)]}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (!open ? setDeleting(null) : undefined)}
        title={`Hapus menu "${deleting?.label ?? ""}"?`}
        description={
          deleting && deleting.children.length > 0
            ? `${deleting.children.length} submenu di bawahnya ikut dihapus.`
            : "Menu akan hilang dari situs dalam beberapa detik."
        }
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}

function NavRow({
  item,
  handle,
  onEdit,
  onDelete,
  extra,
}: {
  item: NavItem;
  handle: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  extra?: ReactNode;
}) {
  const external = /^https?:\/\//.test(item.href);
  return (
    <div className="flex items-center gap-3 py-2 pr-1">
      {handle}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium text-fg-strong">{item.label}</p>
        <p className="flex items-center gap-1 truncate font-mono text-xs text-fg-muted">
          {item.href}
          {external ? <ExternalLinkIcon className="size-3" aria-label="tautan eksternal" /> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {extra}
        <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${item.label}`} onClick={onEdit}>
          <PencilIcon strokeWidth={1.5} aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Hapus ${item.label}`} onClick={onDelete}>
          <Trash2Icon strokeWidth={1.5} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

const navFormSchema = z.object({
  label: z.string().trim().min(1, { error: "Label wajib diisi." }).max(60, { error: "Label maksimal 60 karakter." }),
  href: z
    .string()
    .trim()
    .min(1, { error: "Tautan wajib diisi." })
    .max(500)
    .regex(/^(\/(?!\/)[^\s\\]*|https?:\/\/\S+)$/, {
      error: "Tautan harus diawali / (mis. /pelatihan) atau http(s)://.",
    }),
  parentId: z.string(),
});
type NavFormValues = z.infer<typeof navFormSchema>;

function NavItemDialog({
  state,
  roots,
  onClose,
}: {
  state: DialogState;
  roots: NavItem[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const editing = state.mode === "edit" ? state.item : null;
  const form = useForm<NavFormValues>({
    resolver: zodResolver(navFormSchema),
    defaultValues: {
      label: editing?.label ?? "",
      href: editing?.href ?? "",
      parentId: (editing ? editing.parentId : state.mode === "create" ? state.parentId : null) ?? NO_PARENT,
    },
  });

  const save = useMutation({
    mutationFn: async (values: NavFormValues) => {
      const parentId = values.parentId === NO_PARENT ? null : values.parentId;
      if (editing) {
        return apiSend(`/admin/nav/${editing.id}`, "PATCH", { label: values.label, href: values.href, parentId });
      }
      const location = state.mode === "create" ? state.location : "HEADER";
      return apiSend("/admin/nav", "POST", { location, label: values.label, href: values.href, parentId });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: navKey });
      toast.success(editing ? "Menu diperbarui." : "Menu ditambahkan.");
      onClose();
    },
    onError: (error) => {
      if (!applyFieldErrors(error, form.setError, ["label", "href", "parentId"])) toast.error(errorMessage(error));
    },
  });

  // Induk yang boleh: item level atas selain dirinya. Item yang punya submenu tetap di level atas.
  const parentOptions = roots.filter((root) => root.id !== editing?.id);
  const canChangeParent = !(editing && editing.children.length > 0);
  const errors = form.formState.errors;

  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Ubah menu" : "Tambah menu"}</DialogTitle>
          <DialogDescription>Tautan internal diawali / (mis. /jadwal). Tautan luar memakai https://.</DialogDescription>
        </DialogHeader>
        <form
          id="nav-item-form"
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
        >
          <FormField id="nav-label" label="Label" required error={errors.label?.message}>
            <Input {...form.register("label")} autoFocus />
          </FormField>
          <FormField id="nav-href" label="Tautan" required error={errors.href?.message}>
            <Input {...form.register("href")} placeholder="/pelatihan" />
          </FormField>
          <Controller
            control={form.control}
            name="parentId"
            render={({ field }) => (
              <div className="space-y-2">
                <Label htmlFor="nav-parent">Induk</Label>
                <Select value={field.value} onValueChange={field.onChange} disabled={!canChangeParent}>
                  <SelectTrigger id="nav-parent" className="w-full" aria-describedby="nav-parent-help">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT}>Tanpa induk (menu utama)</SelectItem>
                    {parentOptions.map((root) => (
                      <SelectItem key={root.id} value={root.id}>
                        {root.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="nav-parent-help" className="text-small text-fg-muted">
                  {canChangeParent
                    ? "Pilih induk untuk menjadikannya submenu (dropdown)."
                    : "Menu yang punya submenu tidak bisa dijadikan submenu."}
                </p>
                {errors.parentId?.message ? (
                  <p className="text-small text-status-error">{errors.parentId.message}</p>
                ) : null}
              </div>
            )}
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="ghost" disabled={save.isPending} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="nav-item-form" disabled={save.isPending} aria-busy={save.isPending}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
