"use client";

import { useQuery } from "@tanstack/react-query";
import { ImageOffIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { PortfolioItem } from "@/lib/api/types";
import { PortfolioForm, portfolioKeys } from "../portfolio-form";

export function EditPortfolio({ id }: { id: string }) {
  const query = useQuery({
    queryKey: portfolioKeys.detail(id),
    queryFn: async () => (await apiFetch<PortfolioItem>(`/admin/portfolio/${id}`)).data,
  });

  if (query.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Memuat portofolio">
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
        icon={ImageOffIcon}
        title={notFound ? "Portofolio tidak ditemukan" : "Portofolio tidak dapat dimuat"}
        description={notFound ? "Portofolio mungkin sudah dihapus." : "Periksa koneksi lalu coba lagi."}
        action={
          notFound ? (
            <Button variant="outline" asChild>
              <Link href="/admin/portfolio">Kembali ke daftar</Link>
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
      <PageHeader title={query.data.title} description={query.data.client ?? undefined} />
      <PortfolioForm item={query.data} />
    </>
  );
}
