import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { PortfolioList } from "./portfolio-list";

export const metadata: Metadata = { title: "Portofolio" };

export default function PortfolioPage() {
  return (
    <>
      <PageHeader
        title="Portofolio"
        description="Dokumentasi kegiatan pelatihan beserta galeri foto."
        actions={
          <Button asChild>
            <Link href="/admin/portfolio/new">
              <PlusIcon aria-hidden />
              Tambah portofolio
            </Link>
          </Button>
        }
      />
      <PortfolioList />
    </>
  );
}
