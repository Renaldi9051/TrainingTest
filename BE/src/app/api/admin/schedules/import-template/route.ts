import { NextResponse } from "next/server";
import { adminRoute } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { scheduleImportTemplate } from "@/services/schedule-import";

export const dynamic = "force-dynamic";

export const GET = adminRoute(async () => {
  const example = await getDb().training.findFirst({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { slug: true },
  });
  // BOM supaya Excel membaca UTF-8 dengan benar.
  const body = `﻿${scheduleImportTemplate(example?.slug ?? "slug-pelatihan")}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="template-jadwal.csv"',
    },
  });
});
