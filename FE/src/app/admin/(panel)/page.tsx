import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { Dashboard } from "./dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan konten website dan yang perlu dirapikan." />
      <Dashboard />
    </>
  );
}
