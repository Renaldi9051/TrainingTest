import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { MediaLibrary } from "./media-library";

export const metadata: Metadata = { title: "Media library" };

export default function MediaPage() {
  return (
    <>
      <PageHeader
        title="Media library"
        description="Upload gambar dan PDF. Gambar otomatis dikonversi ke WebP dengan beberapa ukuran."
      />
      {/* useSearchParams (?media=) butuh Suspense. */}
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <MediaLibrary />
      </Suspense>
    </>
  );
}
