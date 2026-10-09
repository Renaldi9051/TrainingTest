import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { TrainingForm } from "../training-form";

export const metadata: Metadata = { title: "Tambah pelatihan" };

export default function NewTrainingPage() {
  return (
    <>
      <PageHeader title="Tambah pelatihan" />
      <TrainingForm training={null} />
    </>
  );
}
