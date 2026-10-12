"use client";

import { useQuery } from "@tanstack/react-query";
import { FileXIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Service } from "@/lib/api/types";
import { ServiceForm, serviceKeys } from "../service-form";

export function EditService({ id }: { id: string }) {
  const query = useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: async () => (await apiFetch<Service>(`/admin/services/${id}`)).data,
  });

  if (query.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Memuat layanan">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-40 w-full max-w-xl" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 422);
    return (
      <EmptyState
        icon={FileXIcon}
        title={notFound ? "Layanan tidak ditemukan" : "Layanan tidak dapat dimuat"}
        description={notFound ? "Layanan mungkin sudah dihapus." : "Periksa koneksi lalu coba lagi."}
        action={
          notFound ? (
            <Button variant="outline" asChild>
              <Link href="/admin/services">Kembali ke daftar</Link>
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
      <PageHeader title={query.data.title} description={`/layanan/${query.data.slug}`} />
      <ServiceForm service={query.data} />
    </>
  );
}
