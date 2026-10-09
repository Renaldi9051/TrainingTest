import type { Metadata } from "next";
import { Suspense } from "react";
import { ScheduleTableSkeleton } from "@/components/public/schedule-table";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ScheduleList } from "./schedule-list";

export const metadata: Metadata = {
  title: "Jadwal pelatihan",
  alternates: { canonical: "/jadwal" },
};

// Tampilan list + filter bulan, kota, kategori. Tampilan kalender menyusul (Fase 4).
export default function SchedulePage({ searchParams }: PageProps<"/jadwal">) {
  return (
    <Container className="py-16 md:py-24">
      <Eyebrow>Jadwal</Eyebrow>
      <h1 className="mt-4 text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
        Jadwal pelatihan
      </h1>
      <Suspense
        fallback={
          <div className="mt-10 space-y-8">
            <div className="h-20 max-w-3xl bg-bg-muted" />
            <ScheduleTableSkeleton rows={8} />
          </div>
        }
      >
        <ScheduleList searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
