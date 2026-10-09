import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { TrainingsList } from "./trainings-list";

export const metadata: Metadata = { title: "Pelatihan" };

export default function TrainingsPage() {
  return (
    <>
      <PageHeader
        title="Pelatihan"
        description="Katalog pelatihan. Hanya pelatihan berstatus tayang yang muncul di situs."
        actions={
          <Button asChild>
            <Link href="/admin/trainings/new">
              <PlusIcon aria-hidden />
              Tambah pelatihan
            </Link>
          </Button>
        }
      />
      <TrainingsList />
    </>
  );
}
