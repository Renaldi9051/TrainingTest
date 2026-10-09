import { adminRoute } from "@/lib/auth";
import { HttpError, ok, readJson } from "@/lib/http";
import { MAX_IMPORT_BYTES, scheduleImportSchema } from "@/lib/validators/schedule";
import { importSchedules } from "@/services/schedule-import";

export const dynamic = "force-dynamic";

// { csv, dryRun: true } = preview per baris; { csv, dryRun: false } = simpan semua atau tidak sama sekali.
export const POST = adminRoute(async (request, _context, admin) => {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMPORT_BYTES * 2) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "File CSV maksimal 1 MB.");
  }
  const input = scheduleImportSchema.parse(await readJson(request));
  return ok(await importSchedules(input, admin.user.id));
});
