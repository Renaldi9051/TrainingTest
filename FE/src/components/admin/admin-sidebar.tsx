"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/admin/ui/sidebar";
import { ADMIN_NAV, adminModuleHref, moduleFromPathname } from "@/lib/admin-nav";
import { apiFetch } from "@/lib/api/client";

// Jumlah inquiry baru (badge). Disegarkan tiap menit selama panel terbuka; inquiryKeys.count.
function useNewInquiries(): number {
  const { data } = useQuery({
    queryKey: ["admin", "inquiries", "count"],
    queryFn: async () => (await apiFetch<{ new: number }>("/admin/inquiries/count")).data.new,
    refetchInterval: 60_000,
  });
  return data ?? 0;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const active = moduleFromPathname(pathname);
  const newInquiries = useNewInquiries();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-4 group-data-[collapsible=icon]:px-2">
        <Link
          href="/admin"
          className="font-mono text-label font-medium uppercase text-fg-strong group-data-[collapsible=icon]:sr-only"
        >
          Panel admin
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {ADMIN_NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-mono text-[11px] uppercase tracking-[0.08em] text-fg-muted">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.modules.map((adminModule) => {
                  const isActive = active?.slug === adminModule.slug;
                  return (
                    <SidebarMenuItem key={adminModule.slug || "dashboard"}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={adminModule.label}>
                        <Link href={adminModuleHref(adminModule)} aria-current={isActive ? "page" : undefined}>
                          <adminModule.icon strokeWidth={1.5} />
                          <span>{adminModule.label}</span>
                          {adminModule.slug === "inquiries" && newInquiries > 0 ? (
                            <span className="ml-auto rounded-full bg-fg-strong px-1.5 font-mono text-[10px] leading-4 text-inverse-fg tabular-nums group-data-[collapsible=icon]:hidden">
                              {newInquiries}
                              <span className="sr-only"> inquiry baru</span>
                            </span>
                          ) : null}
                          {adminModule.available ? null : (
                            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-fg-muted group-data-[collapsible=icon]:hidden">
                              Segera
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
