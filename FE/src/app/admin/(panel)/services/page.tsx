import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { ServicesList } from "./services-list";

export const metadata: Metadata = { title: "Layanan" };

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Layanan"
        description="Layanan di /layanan dan beranda. Urutan di sini dipakai di situs."
        actions={
          <Button asChild>
            <Link href="/admin/services/new">
              <PlusIcon aria-hidden />
              Tambah layanan
            </Link>
          </Button>
        }
      />
      <ServicesList />
    </>
  );
}
