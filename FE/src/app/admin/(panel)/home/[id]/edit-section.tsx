"use client";

import { useQuery } from "@tanstack/react-query";
import { FileXIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { HomeSection } from "@/lib/api/types";
import { HOME_SECTION_LABELS } from "@/lib/home-sections";
import { homeKeys } from "../home-keys";
import { SectionForm } from "../section-form";

export function EditSection({ id }: { id: string }) {
  const query = useQuery({
    queryKey: homeKeys.detail(id),
    queryFn: async () => (await apiFetch<HomeSection>(`/admin/home-sections/${id}`)).data,
  });

  if (query.isPending) {
    return (
      <div className="space-y-6" role="status" aria-label="Memuat section">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full max-w-xl" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 422);
    return (
      <EmptyState
        icon={FileXIcon}
        title={notFound ? "Section tidak ditemukan" : "Section tidak dapat dimuat"}
        description={notFound ? "Section mungkin sudah dihapus." : "Periksa koneksi lalu coba lagi."}
        action={
          notFound ? (
            <Button variant="outline" asChild>
              <Link href="/admin/home">Kembali ke beranda</Link>
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

  const section = query.data;
  return (
    <>
      <PageHeader title={section.title || HOME_SECTION_LABELS[section.type]} description={HOME_SECTION_LABELS[section.type]} />
      {section.content === null ? (
        <p role="status" className="mb-6 flex items-center gap-2 text-small text-status-warning">
          <TriangleAlertIcon className="size-4" strokeWidth={1.5} aria-hidden />
          Isi tersimpan sudah tidak sesuai format terbaru. Isi ulang lalu simpan.
        </p>
      ) : null}
      <SectionForm type={section.type} section={section} />
    </>
  );
}
