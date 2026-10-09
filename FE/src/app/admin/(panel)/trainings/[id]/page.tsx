import type { Metadata } from "next";
import { EditTraining } from "./edit-training";

export const metadata: Metadata = { title: "Ubah pelatihan" };

export default async function EditTrainingPage({ params }: PageProps<"/admin/trainings/[id]">) {
  const { id } = await params;
  return <EditTraining id={id} />;
}
