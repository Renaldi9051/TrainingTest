import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHero } from "@/components/public/page-hero";
import { ScheduleTableSkeleton } from "@/components/public/schedule-table";
import { Container } from "@/components/ui/container";
import { getSettings } from "@/lib/api/public";
import { ScheduleList, ScheduleStats } from "./schedule-list";

export const metadata: Metadata = {
  title: "Jadwal pelatihan",
  alternates: { canonical: "/jadwal" },
};

// Label UI bawaan; diganti isi Pengaturan > Kepala halaman kalau diisi.
const DEFAULT_TITLE = "Jadwal pelatihan";

// Jadwal (mockup jadwal.html): filter bulan, kota, kategori; tampilan list atau kalender bulanan.
export default async function SchedulePage({ searchParams }: PageProps<"/jadwal">) {
  const settings = await getSettings();
  const header = settings.pageHeaders.jadwal;
  return (
    <>
      <PageHero
        crumbs={[{ label: "Jadwal" }]}
        eyebrow={header.eyebrow || undefined}
        title={header.heading || DEFAULT_TITLE}
        lead={header.lead || null}
        outline="Jadwal"
        aside={
          // Angka bergantung pada tanggal hari ini: di-stream; kosong (0) tidak tampil.
          <Suspense fallback={null}>
            <ScheduleStats />
          </Suspense>
        }
      />
      <Container className="pt-8 pb-24 md:pb-32">
        <Suspense
          fallback={
            <div className="space-y-8">
              <div className="h-20 max-w-3xl bg-bg-muted" />
              <ScheduleTableSkeleton rows={8} />
            </div>
          }
        >
          <ScheduleList searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  );
}
