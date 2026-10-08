import { ConstructionIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { ADMIN_MODULES, findAdminModule } from "@/lib/admin-nav";

// Satu halaman "Belum tersedia" untuk semua modul PRD 6.1 yang belum dibuat.
// Slug di luar daftar modul tetap 404.
const pendingModules = ADMIN_MODULES.filter((adminModule) => adminModule.slug && !adminModule.available);

export function generateStaticParams() {
  return pendingModules.map((adminModule) => ({ module: adminModule.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/admin/[module]">): Promise<Metadata> {
  const adminModule = findAdminModule((await params).module);
  return { title: adminModule?.label ?? "Tidak ditemukan" };
}

export default async function PendingModulePage({ params }: PageProps<"/admin/[module]">) {
  const adminModule = findAdminModule((await params).module);
  if (!adminModule || adminModule.available) notFound();

  return (
    <>
      <PageHeader title={adminModule.label} />
      <EmptyState
        icon={ConstructionIcon}
        title="Belum tersedia"
        description={`Modul ${adminModule.label} sedang disiapkan dan akan tersedia di fase berikutnya.`}
        action={
          <Button variant="outline" asChild>
            <Link href="/admin">Kembali ke dashboard</Link>
          </Button>
        }
      />
    </>
  );
}
