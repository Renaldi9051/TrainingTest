import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { ArticleCategoriesButton } from "./article-categories-dialog";
import { ArticlesWorkspace } from "./articles-workspace";

export const metadata: Metadata = { title: "Artikel" };

export default function ArticlesPage() {
  return (
    <>
      <PageHeader
        title="Artikel"
        description="Tulis, jadwalkan, dan kelola artikel di /artikel. Kalender menampilkan artikel tayang dan terjadwal per tanggal (WIB)."
        actions={
          <>
            <ArticleCategoriesButton />
            <Button asChild>
              <Link href="/admin/articles/new">
                <PlusIcon aria-hidden />
                Tulis artikel
              </Link>
            </Button>
          </>
        }
      />
      <ArticlesWorkspace />
    </>
  );
}
