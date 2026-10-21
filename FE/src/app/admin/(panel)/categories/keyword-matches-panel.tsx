"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinkIcon } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { toast } from "sonner";
import { PublicStateLabel } from "@/components/admin/status-dot";
import { Button } from "@/components/admin/ui/button";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { Category, KeywordMatches } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { trainingKeys } from "../trainings/training-keys";
import { categoryKeys } from "./category-form";

// Pelatihan yang judulnya memuat kata kunci kategori tapi belum tertaut. Admin mencentang lalu
// menautkan; tautan hanya ditambah, kategori lama pelatihan tetap.
export function KeywordMatchesPanel({ category }: { category: Category }) {
  const headingId = useId();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const hasKeywords = category.keywords.length > 0;

  const query = useQuery({
    // Kata kunci tersimpan ikut di key: daftar dimuat ulang setelah kata kunci disimpan.
    queryKey: [...categoryKeys.keywordMatches(category.id), category.keywords],
    queryFn: async () => (await apiFetch<KeywordMatches>(`/admin/categories/${category.id}/keyword-matches`)).data,
    enabled: hasKeywords,
  });
  const items = query.data?.items ?? [];
  // Pilihan yang sudah tidak ada di daftar (mis. setelah dimuat ulang) diabaikan.
  const chosen = items.filter((item) => selected.has(item.id)).map((item) => item.id);
  const allChosen = items.length > 0 && chosen.length === items.length;

  const link = useMutation({
    mutationFn: async (trainingIds: string[]) =>
      (await apiSend<{ linked: number }>(`/admin/categories/${category.id}/keyword-matches`, "POST", { trainingIds })).data,
    onSuccess: async ({ linked }) => {
      setSelected(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
        queryClient.invalidateQueries({ queryKey: trainingKeys.all }),
      ]);
      toast.success(`${formatNumber(linked)} pelatihan ditautkan ke ${category.name}.`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <section aria-labelledby={headingId} className="mt-12 space-y-4 border-t border-border pt-8">
      <div className="space-y-1">
        <h2 id={headingId} className="text-base font-semibold text-fg-strong">
          Pelatihan yang cocok
        </h2>
        <p className="max-w-[65ch] text-small text-fg-muted">
          {hasKeywords
            ? `Judulnya memuat ${category.keywords.map((keyword) => `"${keyword}"`).join(", ")} tapi belum ada di kategori ini. Centang lalu tautkan; kategori lain pelatihan tetap.`
            : "Tambahkan kata kunci di atas lalu simpan untuk melihat pelatihan yang judulnya cocok."}
        </p>
      </div>

      {!hasKeywords ? null : query.isPending ? (
        <div className="space-y-2" role="status" aria-label="Memuat pelatihan yang cocok">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex items-center gap-3 text-small">
          <p className="text-status-error">Daftar pelatihan yang cocok tidak dapat dimuat.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-small text-fg-muted">
          {query.data.linkedCount > 0
            ? `Semua ${formatNumber(query.data.linkedCount)} pelatihan yang cocok sudah ada di kategori ini.`
            : "Belum ada judul pelatihan yang cocok dengan kata kunci ini."}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-small">
              <Checkbox
                checked={allChosen ? true : chosen.length > 0 ? "indeterminate" : false}
                onCheckedChange={(checked) => setSelected(checked === true ? new Set(items.map((item) => item.id)) : new Set())}
                aria-label="Pilih semua pelatihan yang cocok"
              />
              Pilih semua
            </label>
            <div className="flex items-center gap-3">
              <p className="text-small text-fg-muted" aria-live="polite">
                {formatNumber(query.data.total)} belum tertaut · {formatNumber(query.data.linkedCount)} sudah tertaut
              </p>
              <Button
                type="button"
                size="sm"
                disabled={chosen.length === 0 || link.isPending}
                aria-busy={link.isPending}
                onClick={() => link.mutate(chosen)}
              >
                <LinkIcon aria-hidden />
                {chosen.length > 0 ? `Tautkan ${formatNumber(chosen.length)} pelatihan` : "Tautkan"}
              </Button>
            </div>
          </div>
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((item) => {
              const checkboxId = `${headingId}-${item.id}`;
              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-bg-subtle">
                  <Checkbox
                    id={checkboxId}
                    className="mt-0.5"
                    checked={selected.has(item.id)}
                    onCheckedChange={(checked) => toggle(item.id, checked === true)}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <label htmlFor={checkboxId} className="font-medium text-fg-strong">
                        {item.title}
                      </label>
                      <PublicStateLabel state={item.publicState} className="text-fg-muted" />
                    </div>
                    <p className="text-small text-fg-muted">
                      {item.categories.length > 0
                        ? `Kategori: ${item.categories.map((itemCategory) => itemCategory.name).join(", ")}`
                        : "Tanpa kategori"}
                      {" · "}
                      <Link href={`/admin/trainings/${item.id}`} className="underline-offset-4 hover:underline">
                        Buka pelatihan
                      </Link>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {query.data.total > items.length ? (
            <p className="text-small text-fg-muted">
              Menampilkan {formatNumber(items.length)} dari {formatNumber(query.data.total)}. Tautkan sebagian dulu atau perjelas kata kunci.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
