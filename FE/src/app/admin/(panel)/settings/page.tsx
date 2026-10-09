import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Pengaturan situs" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Pengaturan situs"
        description="Identitas, kontak, sosial media, footer, dan SEO default. Setiap tab disimpan terpisah."
      />
      <SettingsForm />
    </>
  );
}
