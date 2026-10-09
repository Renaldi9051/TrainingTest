import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Tambah kategori" };

export default function NewCategoryPage() {
  return (
    <>
      <PageHeader title="Tambah kategori" />
      <CategoryForm category={null} />
    </>
  );
}
