"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiSend, errorMessage } from "@/lib/api/client";

type Options = {
  // Path resource admin, mis. "/admin/clients".
  basePath: string;
  // Cache yang disegarkan setelah hapus/pulihkan.
  invalidateKey: QueryKey;
  // Kata benda dengan huruf awal kapital untuk pesan, mis. "Klien".
  noun: string;
  onDeleted?: () => void;
};

// Hapus (soft delete ke Sampah) dengan aksi "Urungkan" di toast yang memanggil
// POST /:id/restore. UI Sampah lengkap menyusul di Fase 5.
export function useDeleteWithUndo({ basePath, invalidateKey, noun, onDeleted }: Options) {
  const queryClient = useQueryClient();

  const restore = useMutation({
    mutationFn: async ({ id }: { id: string; label: string }) => apiSend(`${basePath}/${id}/restore`, "POST"),
    onSuccess: async (_data, { label }) => {
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast.success(`${noun} "${label}" dipulihkan.`);
    },
    onError: (error) => toast.error(errorMessage(error, `${noun} gagal dipulihkan.`)),
  });

  return useMutation({
    mutationFn: async ({ id }: { id: string; label: string }) => apiSend(`${basePath}/${id}`, "DELETE"),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
      onDeleted?.();
      toast.success(`${noun} "${variables.label}" dipindahkan ke Sampah.`, {
        action: { label: "Urungkan", onClick: () => restore.mutate(variables) },
        duration: 10_000,
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
