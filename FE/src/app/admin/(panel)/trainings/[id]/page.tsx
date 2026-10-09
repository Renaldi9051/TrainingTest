import type { Metadata } from "next";
import { EditTraining } from "./edit-training";

// Halaman admin selalu dirender per request (sesi); tidak perlu validasi navigasi instan.
export const instant = false;

export const metadata: Metadata = { title: "Ubah pelatihan" };

export default async function EditTrainingPage({ params }: PageProps<"/admin/trainings/[id]">) {
  const { id } = await params;
  return <EditTraining id={id} />;
}
