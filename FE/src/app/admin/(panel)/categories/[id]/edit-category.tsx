"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderXIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
import { CategoryForm, categoryKeys } from "../category-form";

export function EditCategory({ id }: { id: string }) {
  const query = useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: async () => (await apiFetch<Category>(`/admin/categories/${id}`)).data,
  });

  if (query.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Memuat kategori">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-9 w-full max-w-xl" />
        <Skeleton className="h-24 w-full max-w-xl" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 422);
    return (
      <EmptyState
        icon={FolderXIcon}
        title={notFound ? "Kategori tidak ditemukan" : "Kategori tidak dapat dimuat"}
        description={notFound ? "Kategori mungkin sudah dihapus." : "Periksa koneksi lalu coba lagi."}
        action={
          notFound ? (
            <Button variant="outline" asChild>
              <Link href="/admin/categories">Kembali ke daftar</Link>
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
      <PageHeader title={query.data.name} description={`/pelatihan/kategori/${query.data.slug}`} />
      <CategoryForm category={query.data} />
    </>
  );
}
