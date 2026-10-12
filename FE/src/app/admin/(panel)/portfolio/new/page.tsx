import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { PortfolioForm } from "../portfolio-form";

export const metadata: Metadata = { title: "Tambah portofolio" };

export default function NewPortfolioPage() {
  return (
    <>
      <PageHeader title="Tambah portofolio" />
      <PortfolioForm item={null} />
    </>
  );
}
