import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { countNewInquiries } from "@/services/inquiry";

export const dynamic = "force-dynamic";

// Jumlah inquiry baru untuk badge sidebar admin.
export const GET = adminRoute(async () => ok({ new: await countNewInquiries() }));
