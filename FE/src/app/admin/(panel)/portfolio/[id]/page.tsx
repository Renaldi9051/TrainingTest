import type { Metadata } from "next";
import { EditPortfolio } from "./edit-portfolio";

// Halaman admin selalu dirender per request (sesi); tidak perlu validasi navigasi instan.
export const instant = false;

export const metadata: Metadata = { title: "Ubah portofolio" };

export default async function EditPortfolioPage({ params }: PageProps<"/admin/portfolio/[id]">) {
  const { id } = await params;
  return <EditPortfolio id={id} />;
}
