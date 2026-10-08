import type { Metadata } from "next";
import { AdminProviders } from "./providers";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <AdminProviders>{children}</AdminProviders>;
}
