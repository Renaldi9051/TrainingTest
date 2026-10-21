"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { CategoryPicker } from "@/components/admin/category-picker";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { Label } from "@/components/admin/ui/label";
import { ApiError, apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { Category, CategoryMergeResult, CategoryOption } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { trainingKeys } from "../trainings/training-keys";
import { categoryKeys } from "./category-form";

// Gabungkan kategori kembar: pelatihan pindah ke tujuan, kategori ini masuk Sampah, URL lama
// dialihkan (301), dan menu diarahkan ke tujuan.
export function CategoryMergeDialog({
  category,
  open,
  onOpenChange,
  onMerged,
}: {
  category: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Dipanggil sebelum pindah halaman (mis. reset form supaya penjaga perubahan tidak bertanya).
  onMerged: () => void;
}) {
  const pickerId = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = useQuery({
    queryKey: categoryKeys.options,
    queryFn: async () => (await apiFetch<CategoryOption[]>("/admin/categories/options")).data,
    enabled: open,
  });
  const targets = useMemo(() => (options.data ?? []).filter((item) => item.id !== category.id), [options.data, category.id]);
  const target = targets.find((item) => item.id === targetId);

  const merge = useMutation({
    mutationFn: async () =>
      (await apiSend<CategoryMergeResult>(`/admin/categories/${category.id}/merge`, "POST", { targetId })).data,
    onSuccess: async (result) => {
      queryClient.removeQueries({ queryKey: categoryKeys.detail(category.id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
        queryClient.invalidateQueries({ queryKey: trainingKeys.all }),
      ]);
      toast.success(
        `"${category.name}" digabung ke "${result.target.name}". ${formatNumber(result.movedTrainings)} tautan pelatihan dipindah.`,
      );
      onMerged();
      onOpenChange(false);
      router.push(`/admin/categories/${result.target.id}`);
    },
    onError: (mergeError) => {
      setError(
        mergeError instanceof ApiError && mergeError.fields?.targetId?.[0]
          ? mergeError.fields.targetId[0]
          : errorMessage(mergeError),
      );
    },
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTargetId("");
          setError(null);
        }
        onOpenChange(next);
      }}
      title={`Gabungkan "${category.name}"?`}
      description={`Semua pelatihan di kategori ini (${formatNumber(category.trainingCount)}) dipindah ke kategori tujuan dan kata kuncinya digabung. "${category.name}" masuk Sampah, alamat /pelatihan/kategori/${category.slug} dialihkan ke kategori tujuan, dan menu yang menuju kategori ini ikut diarahkan.`}
      confirmLabel="Gabungkan"
      pending={merge.isPending}
      onConfirm={() => {
        if (!targetId) {
          setError("Pilih kategori tujuan.");
          return;
        }
        setError(null);
        merge.mutate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={pickerId}>Kategori tujuan</Label>
        {options.isError ? (
          <p className="text-small text-status-error">
            Daftar kategori tidak dapat dimuat.{" "}
            <button type="button" className="underline underline-offset-4" onClick={() => void options.refetch()}>
              Coba lagi
            </button>
          </p>
        ) : (
          <CategoryPicker
            id={pickerId}
            label={target ? `Kategori tujuan: ${target.name}` : "Pilih kategori tujuan"}
            options={targets}
            value={targetId}
            onChange={(value) => {
              setTargetId(value);
              setError(null);
            }}
            emptyLabel={options.isPending ? "Memuat kategori..." : "Pilih kategori"}
          />
        )}
        {error ? (
          <p role="alert" className="text-small text-status-error">
            {error}
          </p>
        ) : null}
      </div>
    </ConfirmDialog>
  );
}
