"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/admin/empty-state";
import { SortableList } from "@/components/admin/sortable-list";
import { TableSkeleton } from "@/components/admin/table-skeleton";
import { Button } from "@/components/admin/ui/button";
import { apiSend, errorMessage } from "@/lib/api/client";

type ReorderPanelProps<TItem extends { id: string }> = {
  // Cache daftar yang diurutkan (diubah optimistik saat item dilepas).
  queryKey: QueryKey;
  load: () => Promise<TItem[]>;
  // POST { ids } ke endpoint reorder generik BE, mis. "/admin/services/reorder".
  reorderPath: string;
  // Cache lain yang perlu disegarkan setelah urutan tersimpan (mis. tabel daftar).
  invalidateKey: QueryKey;
  itemLabel: (item: TItem) => string;
  // Isi baris setelah grip; default hanya label.
  renderItem?: (item: TItem) => ReactNode;
  // Kata benda untuk pesan, mis. "kategori".
  noun: string;
  emptyIcon?: LucideIcon;
};

// Mode urutkan: semua baris aktif dalam satu daftar drag & drop (mouse/sentuh/keyboard).
// Urutan langsung disimpan setiap kali item dilepas.
export function ReorderPanel<TItem extends { id: string }>({
  queryKey,
  load,
  reorderPath,
  invalidateKey,
  itemLabel,
  renderItem,
  noun,
  emptyIcon,
}: ReorderPanelProps<TItem>) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey, queryFn: load });

  const save = useMutation({
    mutationFn: async (ids: string[]) => apiSend(reorderPath, "POST", { ids }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success(`Urutan ${noun} disimpan.`);
    },
    onError: (error) => {
      toast.error(errorMessage(error, "Urutan gagal disimpan."));
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  if (query.isPending) return <TableSkeleton rows={8} columns={2} />;
  if (query.isError) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
        <p className="text-small text-status-error">Daftar {noun} tidak dapat dimuat.</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  }
  if (query.data.length === 0) {
    return <EmptyState icon={emptyIcon} title={`Belum ada ${noun} untuk diurutkan`} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-small text-fg-muted">
        Seret grip, atau fokus ke grip lalu tekan Spasi dan panah atas/bawah. Urutan tersimpan otomatis.
      </p>
      <SortableList
        items={query.data}
        itemLabel={itemLabel}
        disabled={save.isPending}
        onReorder={(ids) => {
          queryClient.setQueryData<TItem[]>(queryKey, (current) =>
            current
              ? ids.map((id) => current.find((item) => item.id === id)).filter((item): item is TItem => Boolean(item))
              : current,
          );
          save.mutate(ids);
        }}
        renderItem={(item, handle) => (
          <div className="flex items-center gap-3 py-2">
            {handle}
            {renderItem ? renderItem(item) : <span className="font-medium text-fg-strong">{itemLabel(item)}</span>}
          </div>
        )}
      />
    </div>
  );
}
