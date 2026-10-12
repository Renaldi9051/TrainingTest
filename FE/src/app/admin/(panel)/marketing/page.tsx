import type { Metadata } from "next";
import { MarketingManager } from "./marketing-manager";

export const metadata: Metadata = { title: "Kontak marketing" };

export default function MarketingPage() {
  return <MarketingManager />;
}
