"use client";

import { useQuery } from "@tanstack/react-query";
import { BookXIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Training } from "@/lib/api/types";
import { trainingKeys } from "../training-keys";
import { TrainingForm } from "../training-form";

export function EditTraining({ id }: { id: string }) {
  const query = useQuery({
    queryKey: trainingKeys.detail(id),
    queryFn: async () => (await apiFetch<Training>(`/admin/trainings/${id}`)).data,
  });

  if (query.isPending) {
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]" role="status" aria-label="Memuat pelatihan">
        <div className="space-y-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 422);
    return (
      <EmptyState
        icon={BookXIcon}
        title={notFound ? "Pelatihan tidak ditemukan" : "Pelatihan tidak dapat dimuat"}
        description={notFound ? "Pelatihan mungkin sudah dihapus." : "Periksa koneksi lalu coba lagi."}
        action={
          notFound ? (
            <Button variant="outline" asChild>
              <Link href="/admin/trainings">Kembali ke daftar</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void query.refetch()}>
              Coba lagi
            </Button>
          )
        }
      />
    );
  }

  return (
    <>
      <PageHeader title={query.data.title} description={`/pelatihan/${query.data.slug}`} />
      {/* key: form dibuat ulang kalau berpindah ke pelatihan lain (mis. setelah duplikasi). */}
      <TrainingForm key={query.data.id} training={query.data} />
    </>
  );
}
