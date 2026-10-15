"use client";

import { ArrowRightIcon, ChevronDownIcon, LayoutGridIcon, MenuIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { PublicNavItem } from "@/lib/api/types";
import { IndicatorMark, useActiveIndicator } from "@/components/motion/active-indicator";
import { OPEN_PUBLIC_SEARCH_EVENT } from "@/lib/public-search-event";
import { cn } from "@/lib/utils";
import { IndexOverlay } from "./index-overlay";

type HeaderNavProps = {
  items: PublicNavItem[];
  cta: { label: string; href: string } | null;
};

// Submenu lebih panjang dari ini tidak memakai dropdown, tapi overlay indeks A-Z (PRD 5.2: kategori
// 70+ tidak boleh jadi dropdown panjang).
export const DROPDOWN_MAX_ITEMS = 8;

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

// Warna mengikuti header (gelap di header putih, terang di atas foto hero). Garis bawah memanjang
// dari kiri saat hover; menu aktif bergaris penuh + medium. Di menu desktop, setelah JS siap, garis
// menu aktif digantikan indikator yang bergeser antar menu (useActiveIndicator).
const linkClass =
  "relative rounded-sm py-1.5 text-small text-current outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 focus-visible:ring-offset-transparent aria-[current=page]:font-medium after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-standard hover:after:scale-x-100 aria-[current=page]:after:scale-x-100 [[data-indicator-ready]_&]:aria-[current=page]:after:scale-x-0";

const toggleClass =
  "inline-flex size-6 items-center justify-center rounded-sm text-current opacity-70 outline-none transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-current";

// Hanya menu tingkat atas (bukan link di panel submenu). Menu dengan submenu: link label di
// dalam split button.
const TOP_LEVEL_ACTIVE = ":scope > ul > li > a[aria-current], :scope > ul > li > div > a[aria-current]";

const indexItems = (item: PublicNavItem) => item.children.map((child) => ({ label: child.label, href: child.href }));

// Menu desktop (dropdown 1 level / overlay A-Z) dan menu mobile layar penuh. Semua bisa dipakai
// dengan keyboard.
export function HeaderNav({ items, cta }: HeaderNavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Menu yang overlay indeksnya sedang terbuka (href induk).
  const [indexFor, setIndexFor] = useState<PublicNavItem | null>(null);
  const mobileId = useId();
  const desktopNavRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  useActiveIndicator(desktopNavRef, indicatorRef, { variant: "line", selector: TOP_LEVEL_ACTIVE });

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
      <nav ref={desktopNavRef} aria-label="Menu utama" className="relative hidden lg:block">
        <IndicatorMark variant="line" ref={indicatorRef} className="bg-current" />
        <ul className="flex items-center gap-7 xl:gap-8">
          {items.map((item) => (
            <li key={`${item.label}-${item.href}`}>
              {item.children.length > DROPDOWN_MAX_ITEMS ? (
                <div className="flex items-center gap-0.5">
                  <NavLink item={item} pathname={pathname} className={linkClass} />
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Indeks ${item.label}`}
                    onClick={() => setIndexFor(item)}
                    className={toggleClass}
                  >
                    <LayoutGridIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
              ) : item.children.length > 0 ? (
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
        className="ml-auto inline-flex size-10 items-center justify-center rounded-md text-current outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 lg:hidden"
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
        className="fixed inset-x-0 top-18 bottom-0 z-40 overflow-y-auto bg-bg text-fg lg:hidden"
      >
        <nav aria-label="Menu utama (mobile)" className="px-4 py-6">
          <ul className="divide-y divide-border border-y border-border">
            {items.map((item) => (
              <li key={`${item.label}-${item.href}`} className="py-3">
                <NavLink
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                  className="block text-h3 text-fg-strong underline-offset-4 aria-[current=page]:underline"
                />
                {item.children.length > DROPDOWN_MAX_ITEMS ? (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => setIndexFor(item)}
                    className="mt-2 inline-flex items-center gap-2 rounded-sm py-1 font-mono text-label uppercase tracking-[0.08em] text-fg-muted outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong"
                  >
                    Indeks {item.label} ({item.children.length})
                    <ArrowRightIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
                  </button>
                ) : item.children.length > 0 ? (
                  <ul className="mt-2 space-y-2 pl-4">
                    {item.children.map((child) => (
                      <li key={`${child.label}-${child.href}`}>
                        <NavLink
                          item={child}
                          pathname={pathname}
                          onNavigate={() => setMobileOpen(false)}
                          className="block text-body text-fg underline-offset-4 aria-[current=page]:underline"
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
              // Dengan JS: tutup menu lalu buka palette search (SearchTrigger di header); tanpa JS ke katalog.
              onClick={(event) => {
                setMobileOpen(false);
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                window.dispatchEvent(new Event(OPEN_PUBLIC_SEARCH_EVENT));
              }}
              aria-haspopup="dialog"
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

      <IndexOverlay
        open={indexFor !== null}
        onClose={() => setIndexFor(null)}
        items={indexFor ? indexItems(indexFor) : []}
        allHref={indexFor?.href}
        allLabel={indexFor ? `Semua ${indexFor.label.toLowerCase()}` : undefined}
      />
    </>
  );
}

function Dropdown({ item, pathname }: { item: PublicNavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Fokus kembali ke tombol panah kalau fokus sedang di dalam submenu.
      if (ref.current?.contains(document.activeElement)) toggleRef.current?.focus();
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
      className="relative flex items-center gap-0.5"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {/* Split button: label = link ke halaman induk, panah = buka/tutup submenu (area klik 24x24 px). */}
      <NavLink item={item} pathname={pathname} onNavigate={() => setOpen(false)} className={linkClass} />
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Submenu ${item.label}`}
        onClick={() => setOpen((current) => !current)}
        className={toggleClass}
      >
        <ChevronDownIcon
          className={cn("size-4 transition-transform duration-150", open && "rotate-180")}
          strokeWidth={1.5}
          aria-hidden
        />
      </button>
      {/* Panel monokrom tanpa bayangan (DESIGN.md 5): garis 1 px. */}
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full left-0 z-50 mt-3 w-64 rounded-md border border-border bg-bg py-2 text-fg"
      >
        <ul>
          {item.children.map((child) => (
            <li key={`${child.label}-${child.href}`}>
              <NavLink
                item={child}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                className="block px-4 py-2 text-small text-fg outline-none transition-colors duration-150 hover:bg-bg-subtle hover:text-fg-strong focus-visible:bg-bg-subtle aria-[current=page]:font-medium"
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
