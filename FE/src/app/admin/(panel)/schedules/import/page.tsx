import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ScheduleImport } from "./schedule-import";

export const metadata: Metadata = { title: "Import jadwal" };

export default function ScheduleImportPage() {
  return (
    <>
      <PageHeader
        title="Import jadwal"
        description="Unggah CSV, periksa pratinjau per baris, lalu simpan. Semua baris disimpan sekaligus atau tidak sama sekali."
      />
      <ScheduleImport />
    </>
  );
}
