import type { Metadata } from "next";
import { MediaPartnersManager } from "./media-partners-manager";

export const metadata: Metadata = { title: "Media partner" };

export default function MediaPartnersPage() {
  return <MediaPartnersManager />;
}
