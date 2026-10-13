import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/auth";
import { parseSearchParams } from "@/lib/list-query";
import { inquiryExportQuerySchema } from "@/lib/validators/inquiry";
import { exportInquiries } from "@/services/inquiry";

export const dynamic = "force-dynamic";

// ?status=&from=&to=&q= -> CSV (UTF-8 + BOM, pemisah ;). Maks 10.000 baris. Dicatat di AuditLog.
export const GET = adminRoute(async (request, _context, admin) => {
  const query = parseSearchParams(inquiryExportQuerySchema, request.nextUrl.searchParams);
  const { filename, body, rows } = await exportInquiries(query, admin.user.id);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Export-Rows": String(rows),
    },
  });
});
