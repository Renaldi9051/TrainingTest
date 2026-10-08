"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { DashboardStats as Stats } from "@/lib/api/types";

const ITEMS: { key: keyof Stats; label: string }[] = [
  { key: "trainings", label: "Pelatihan" },
  { key: "categories", label: "Kategori" },
  { key: "schedulesThisMonth", label: "Jadwal bulan ini" },
  { key: "media", label: "File media" },
];

const numberFormat = new Intl.NumberFormat("id-ID");

export function DashboardStats() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => (await apiFetch<Stats>("/admin/dashboard")).data,
  });

  if (isError) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
        <p className="text-small text-status-error">Ringkasan tidak dapat dimuat.</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-4">
      {ITEMS.map((item) => (
        <div key={item.key} className="border-r border-b border-border p-5">
          <dt className="font-mono text-label font-medium uppercase text-fg-muted">{item.label}</dt>
          <dd className="mt-3 font-mono text-3xl font-medium tracking-tight text-fg-strong tabular-nums">
            {isPending ? (
              <Skeleton className="h-9 w-16" aria-label="Memuat" />
            ) : (
              numberFormat.format(data[item.key])
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
