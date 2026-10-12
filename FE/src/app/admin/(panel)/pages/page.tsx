import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { PagesList } from "./pages-list";

export const metadata: Metadata = { title: "Halaman" };

export default function PagesPage() {
  return (
    <>
      <PageHeader
        title="Halaman"
        description="Halaman profil dan halaman statis. Isi disusun dari blok."
        actions={
          <Button asChild>
            <Link href="/admin/pages/new">
              <PlusIcon aria-hidden />
              Tambah halaman
            </Link>
          </Button>
        }
      />
      <PagesList />
    </>
  );
}
