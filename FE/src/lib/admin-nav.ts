import {
  BookOpenIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderTreeIcon,
  HistoryIcon,
  HouseIcon,
  ImageIcon,
  ImagesIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LayoutListIcon,
  MegaphoneIcon,
  MenuIcon,
  MessageSquareQuoteIcon,
  PhoneIcon,
  Settings2Icon,
  SignpostIcon,
  BriefcaseBusinessIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminModule = {
  // Segmen URL di bawah /admin; "" = dashboard.
  slug: string;
  label: string;
  icon: LucideIcon;
  // false = belum dibuat; halaman menampilkan "Belum tersedia".
  available: boolean;
};

export type AdminNavGroup = { label: string; modules: AdminModule[] };

// Modul mengikuti PRD 6.1.
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Umum",
    modules: [{ slug: "", label: "Dashboard", icon: LayoutDashboardIcon, available: true }],
  },
  {
    label: "Situs",
    modules: [
      { slug: "settings", label: "Pengaturan situs", icon: Settings2Icon, available: true },
      { slug: "navigation", label: "Navigasi", icon: MenuIcon, available: true },
      { slug: "home", label: "Beranda", icon: HouseIcon, available: false },
      { slug: "pages", label: "Halaman", icon: FileTextIcon, available: false },
      { slug: "services", label: "Layanan", icon: LayoutListIcon, available: false },
    ],
  },
  {
    label: "Katalog",
    modules: [
      { slug: "categories", label: "Kategori", icon: FolderTreeIcon, available: true },
      { slug: "trainings", label: "Pelatihan", icon: BookOpenIcon, available: true },
      { slug: "schedules", label: "Jadwal", icon: CalendarDaysIcon, available: true },
    ],
  },
  {
    label: "Konten pendukung",
    modules: [
      { slug: "clients", label: "Klien", icon: BriefcaseBusinessIcon, available: false },
      { slug: "testimonials", label: "Testimoni", icon: MessageSquareQuoteIcon, available: false },
      { slug: "portfolio", label: "Portofolio", icon: ImageIcon, available: false },
      { slug: "marketing", label: "Kontak marketing", icon: PhoneIcon, available: false },
      { slug: "media-partners", label: "Media partner", icon: MegaphoneIcon, available: false },
      { slug: "media", label: "Media library", icon: ImagesIcon, available: true },
    ],
  },
  {
    label: "Masuk",
    modules: [
      { slug: "inquiries", label: "Inquiry", icon: InboxIcon, available: false },
      { slug: "evaluations", label: "Evaluasi", icon: ClipboardListIcon, available: false },
    ],
  },
  {
    label: "Sistem",
    modules: [
      { slug: "seo", label: "SEO & redirect", icon: SignpostIcon, available: false },
      { slug: "accounts", label: "Akun admin", icon: UsersIcon, available: false },
      { slug: "audit-log", label: "Audit log", icon: HistoryIcon, available: false },
    ],
  },
];

export const ADMIN_MODULES: AdminModule[] = ADMIN_NAV.flatMap((group) => group.modules);

export function adminModuleHref(adminModule: Pick<AdminModule, "slug">): string {
  return adminModule.slug ? `/admin/${adminModule.slug}` : "/admin";
}

export function findAdminModule(slug: string): AdminModule | undefined {
  return ADMIN_MODULES.find((adminModule) => adminModule.slug === slug);
}

// Modul aktif dari pathname, mis. /admin/media/123 -> Media library.
export function moduleFromPathname(pathname: string): AdminModule | undefined {
  const segment = pathname.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
  return findAdminModule(segment);
}
