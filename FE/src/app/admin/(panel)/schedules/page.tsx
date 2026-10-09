import { FileUpIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/table-skeleton";
import { Button } from "@/components/admin/ui/button";
import { SchedulesList } from "./schedules-list";

export const metadata: Metadata = { title: "Jadwal" };

export default function SchedulesPage() {
  return (
    <>
      <PageHeader
        title="Jadwal"
        description="Sesi pelatihan. Sesi yang tanggal selesainya lewat otomatis tampil SELESAI di situs."
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/schedules/import">
              <FileUpIcon aria-hidden />
              Import CSV
            </Link>
          </Button>
        }
      />
      {/* useSearchParams (filter ?trainingId=) butuh Suspense. */}
      <Suspense fallback={<TableSkeleton rows={8} columns={5} />}>
        <SchedulesList />
      </Suspense>
    </>
  );
}
