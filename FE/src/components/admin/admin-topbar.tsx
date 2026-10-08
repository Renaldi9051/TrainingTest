"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/admin/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui/dropdown-menu";
import { Separator } from "@/components/admin/ui/separator";
import { SidebarTrigger } from "@/components/admin/ui/sidebar";
import { moduleFromPathname } from "@/lib/admin-nav";
import { apiFetch } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";
import { ADMIN_LOGIN } from "@/lib/session";

type Crumb = { label: string; href?: string };

function breadcrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Admin", href: "/admin" }];
  if (pathname.startsWith("/admin/dev/ui")) return [...crumbs, { label: "Komponen UI" }];
  const adminModule = moduleFromPathname(pathname);
  if (!adminModule || adminModule.slug === "") return [{ label: "Dashboard" }];
  return [...crumbs, { label: adminModule.label }];
}

export function AdminTopbar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const crumbs = breadcrumbs(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg px-4">
      <SidebarTrigger aria-label="Ciutkan atau buka sidebar" />
      <Separator orientation="vertical" className="h-5!" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <Fragment key={crumb.label}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {crumb.href && index < crumbs.length - 1 ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <UserMenu user={user} />
    </header>
  );
}

function UserMenu({ user }: { user: AuthUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      queryClient.clear();
      router.replace(ADMIN_LOGIN);
      router.refresh();
    } catch {
      setLoggingOut(false);
      toast.error("Gagal keluar. Coba lagi.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-small text-fg outline-none hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-fg-strong font-mono text-[11px] font-medium uppercase text-inverse-fg">
          {user.name.slice(0, 1)}
        </span>
        <span className="hidden max-w-40 truncate sm:inline">{user.name}</span>
        <ChevronDownIcon className="size-4 text-fg-muted" strokeWidth={1.5} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-small font-medium text-fg-strong">{user.name}</p>
          <p className="truncate text-xs text-fg-muted">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={loggingOut} onSelect={() => void logout()}>
          <LogOutIcon strokeWidth={1.5} />
          {loggingOut ? "Keluar..." : "Keluar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
