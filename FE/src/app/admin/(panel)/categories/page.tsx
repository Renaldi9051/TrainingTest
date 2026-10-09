import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { CategoriesList } from "./categories-list";

export const metadata: Metadata = { title: "Kategori" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Kategori"
        description="Kategori pelatihan. Urutan di sini dipakai di katalog dan filter publik."
        actions={
          <Button asChild>
            <Link href="/admin/categories/new">
              <PlusIcon aria-hidden />
              Tambah kategori
            </Link>
          </Button>
        }
      />
      <CategoriesList />
    </>
  );
}
