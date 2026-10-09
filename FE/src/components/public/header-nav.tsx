"use client";

import { ChevronDownIcon, MenuIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { PublicNavItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type HeaderNavProps = {
  items: PublicNavItem[];
  cta: { label: string; href: string } | null;
};

const isExternal = (href: string) => /^https?:\/\//.test(href);

function isActive(pathname: string, href: string): boolean {
  if (isExternal(href)) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  className,
  onNavigate,
}: {
  item: PublicNavItem;
  pathname: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const external = isExternal(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive(pathname, item.href) ? "page" : undefined}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={className}
    >
      {item.label}
    </Link>
  );
}

// Garis bawah memanjang dari kiri saat hover; menu aktif bergaris penuh.
const linkClass =
  "relative rounded-sm py-1 text-small text-fg outline-none transition-colors duration-150 hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 aria-[current=page]:text-fg-strong after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:scale-x-0 after:bg-fg-strong after:transition-transform after:duration-300 after:ease-standard hover:after:scale-x-100 aria-[current=page]:after:scale-x-100";

// Menu desktop (dropdown 1 level) dan menu mobile layar penuh. Semua bisa dipakai dengan keyboard.
export function HeaderNav({ items, cta }: HeaderNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileId = useId();

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <nav aria-label="Menu utama" className="hidden lg:block">
        <ul className="flex items-center gap-6">
          {items.map((item) => (
            <li key={`${item.label}-${item.href}`}>
              {item.children.length > 0 ? (
                <Dropdown item={item} pathname={pathname} />
              ) : (
                <NavLink item={item} pathname={pathname} className={linkClass} />
              )}
            </li>
          ))}
        </ul>
      </nav>

      <button
        type="button"
        className="ml-auto inline-flex size-10 items-center justify-center rounded-md text-fg-strong outline-none focus-visible:ring-2 focus-visible:ring-fg-strong focus-visible:ring-offset-2 lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls={mobileId}
        aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
        onClick={() => setMobileOpen((open) => !open)}
      >
        {mobileOpen ? <XIcon strokeWidth={1.5} aria-hidden /> : <MenuIcon strokeWidth={1.5} aria-hidden />}
      </button>

      <div
        id={mobileId}
        hidden={!mobileOpen}
        className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto bg-bg lg:hidden"
      >
        <nav aria-label="Menu utama (mobile)" className="px-4 py-6">
          <ul className="divide-y divide-border border-y border-border">
            {items.map((item) => (
              <li key={`${item.label}-${item.href}`} className="py-3">
                <NavLink
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                  className="block text-[20px] leading-[1.25] font-medium text-fg-strong aria-[current=page]:underline"
                />
                {item.children.length > 0 ? (
                  <ul className="mt-2 space-y-2 pl-4">
                    {item.children.map((child) => (
                      <li key={`${child.label}-${child.href}`}>
                        <NavLink
                          item={child}
                          pathname={pathname}
                          onNavigate={() => setMobileOpen(false)}
                          className="block text-body text-fg aria-[current=page]:underline"
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/pelatihan"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-12 items-center gap-2 rounded-md border border-border-strong px-4 text-body"
            >
              <SearchIcon className="size-5" strokeWidth={1.5} aria-hidden />
              Cari pelatihan
            </Link>
            {cta ? (
              <Link
                href={cta.href}
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-12 items-center justify-center rounded-md bg-fg-strong px-4 text-body font-medium text-inverse-fg"
              >
                {cta.label}
              </Link>
            ) : null}
          </div>
        </nav>
      </div>
    </>
  );
}

function Dropdown({ item, pathname }: { item: PublicNavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const active = isActive(pathname, item.href) || item.children.some((child) => isActive(pathname, child.href));

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={active ? "page" : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(linkClass, "inline-flex items-center gap-1")}
      >
        {item.label}
        <ChevronDownIcon
          className={cn("size-4 transition-transform duration-150", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden
        />
      </button>
      <div id={panelId} hidden={!open} className="absolute top-full left-0 mt-3 min-w-56 border border-border bg-bg py-2">
        <ul>
          <li>
            <NavLink
              item={{ ...item, label: `Semua ${item.label.toLowerCase()}` }}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              className="block px-4 py-2 text-small text-fg-muted outline-none hover:bg-bg-subtle hover:text-fg-strong focus-visible:bg-bg-subtle"
            />
          </li>
          {item.children.map((child) => (
            <li key={`${child.label}-${child.href}`}>
              <NavLink
                item={child}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                className="block px-4 py-2 text-small text-fg outline-none hover:bg-bg-subtle hover:text-fg-strong focus-visible:bg-bg-subtle aria-[current=page]:font-medium"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
