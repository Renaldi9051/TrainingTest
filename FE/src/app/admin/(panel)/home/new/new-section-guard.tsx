"use client";

import { useQuery } from "@tanstack/react-query";
import { BanIcon } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { HomeSection, HomeSectionType } from "@/lib/api/types";
import { unavailableTypes } from "@/lib/home-sections";
import { homeKeys } from "../home-keys";
import { SectionForm } from "../section-form";

// Hero/CTA yang sudah ada tidak bisa ditambah lagi (BE juga menolak 409); tampilkan alasannya
// kalau halaman ini dibuka langsung lewat URL.
export function NewSectionGuard({ type }: { type: HomeSectionType }) {
  const query = useQuery({
    queryKey: homeKeys.list,
    queryFn: async () => (await apiFetch<HomeSection[]>("/admin/home-sections")).data,
  });
  if (query.isPending) return <Skeleton className="h-64 w-full" />;
  const reason = query.data ? unavailableTypes(query.data)[type] : undefined;
  if (reason) {
    return (
      <EmptyState
        icon={BanIcon}
        title="Section ini sudah ada"
        description={reason}
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/home">Kembali ke beranda</Link>
          </Button>
        }
      />
    );
  }
  return <SectionForm type={type} section={null} />;
}
