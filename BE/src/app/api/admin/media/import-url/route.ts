import { adminRoute } from "@/lib/auth";
import { ok, readJson } from "@/lib/http";
import { mediaImportUrlSchema } from "@/lib/validators/media";
import { importMediaFromUrl } from "@/services/media";

export const dynamic = "force-dynamic";

// Unduh gambar dari URL luar ke media library (bukan hotlink). Lihat lib/remote-image.ts.
export const POST = adminRoute(async (request, _context, admin) => {
  const input = mediaImportUrlSchema.parse(await readJson(request));
  return ok(await importMediaFromUrl(input, admin.user.id), undefined, 201);
});
