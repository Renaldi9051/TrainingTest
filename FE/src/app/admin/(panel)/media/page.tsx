import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { MediaLibrary } from "./media-library";

export const metadata: Metadata = { title: "Media library" };

export default function MediaPage() {
  return (
    <>
      <PageHeader
        title="Media library"
        description="Upload gambar dan PDF. Gambar otomatis dikonversi ke WebP dengan beberapa ukuran."
      />
      <MediaLibrary />
    </>
  );
}
