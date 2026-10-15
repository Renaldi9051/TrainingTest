import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { NavigationEditor } from "./navigation-editor";

export const metadata: Metadata = { title: "Navigasi" };

export default function NavigationPage() {
  return (
    <>
      <PageHeader
        title="Navigasi"
        description="Menu header dan footer. Buka submenu Pelatihan untuk mencari atau mengubah kategori; seret grip untuk mengubah urutan."
      />
      <NavigationEditor />
    </>
  );
}
