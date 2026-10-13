import type { Metadata } from "next";
import { InquiryDetail } from "./inquiry-detail";

// Halaman admin selalu dirender per request (sesi); tidak perlu validasi navigasi instan.
export const instant = false;

export const metadata: Metadata = { title: "Detail inquiry" };

export default async function InquiryPage({ params }: PageProps<"/admin/inquiries/[id]">) {
  const { id } = await params;
  return <InquiryDetail id={id} />;
}
