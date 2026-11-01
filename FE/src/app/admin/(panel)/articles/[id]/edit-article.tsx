"use client";

import { useQuery } from "@tanstack/react-query";
import { FileXIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { Article } from "@/lib/api/types";
import { ArticleForm } from "../article-form";
import { articleKeys } from "../article-keys";

export function EditArticle({ id }: { id: string }) {
  const query = useQuery({
    queryKey: articleKeys.detail(id),
    queryFn: async () => (await apiFetch<Article>(`/admin/articles/${id}`)).data,
  });

  if (query.isPending) {
    return (
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]" role="status" aria-label="Memuat artikel">
        <div className="space-y-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 422);
    return (
      <EmptyState
        icon={FileXIcon}
        title={notFound ? "Artikel tidak ditemukan" : "Artikel tidak dapat dimuat"}
        description={notFound ? "Artikel mungkin sudah dihapus." : "Periksa koneksi lalu coba lagi."}
        action={
          notFound ? (
            <Button variant="outline" asChild>
              <Link href="/admin/articles">Kembali ke daftar</Link>
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
      <PageHeader title={query.data.title} description={`/artikel/${query.data.slug}`} />
      <ArticleForm key={query.data.id} article={query.data} />
    </>
  );
}
