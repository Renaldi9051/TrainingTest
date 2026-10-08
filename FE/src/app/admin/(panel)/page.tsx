import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { DashboardStats } from "./dashboard-stats";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Ringkasan konten website." />
      <DashboardStats />
    </>
  );
}
