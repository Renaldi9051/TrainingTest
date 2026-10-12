import { ok, route } from "@/lib/http";
import { listPublicPages } from "@/services/page";

export const dynamic = "force-dynamic";

// Slug + judul halaman statis yang tayang (tanpa halaman PROFILE), untuk generateStaticParams.
export const GET = route(async () => ok(await listPublicPages()));
