import { adminRoute } from "@/lib/auth";
import { ok } from "@/lib/http";
import { parseSearchParams } from "@/lib/list-query";
import { inquiryListQuerySchema } from "@/lib/validators/inquiry";
import { listInquiries } from "@/services/inquiry";

export const dynamic = "force-dynamic";

// ?page=&pageSize=&q=&sort=&status=&from=&to= (from/to: tanggal WIB, inklusif).
export const GET = adminRoute(async (request) => {
  const query = parseSearchParams(inquiryListQuerySchema, request.nextUrl.searchParams);
  const { items, meta } = await listInquiries(query);
  return ok(items, meta);
});
