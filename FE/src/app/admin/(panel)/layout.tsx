import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { SidebarInset, SidebarProvider } from "@/components/admin/ui/sidebar";
import { getCurrentAdmin } from "@/lib/api/server";
import { ADMIN_LOGIN } from "@/lib/session";

// Cookie bawaan komponen sidebar shadcn untuk mengingat state buka/ciut.
const SIDEBAR_COOKIE = "sidebar_state";

export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

// Sesi divalidasi di sini (GET /api/auth/me ke BE). Konten admin baru dirender setelah sesi valid.
async function AdminShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentAdmin();
  if (!user) redirect(ADMIN_LOGIN);
  const sidebarOpen = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "false";

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AdminSidebar />
      <SidebarInset className="min-w-0 bg-bg">
        <AdminTopbar user={user} />
        <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AdminShellSkeleton() {
  return (
    <div className="flex min-h-svh" aria-busy="true" aria-label="Memuat panel admin">
      <div className="hidden w-60 shrink-0 border-r border-border bg-bg-subtle md:block" />
      <div className="flex-1">
        <div className="h-14 border-b border-border" />
        <div className="mx-auto max-w-[1200px] space-y-4 px-6 py-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
