import { adminRoute } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/file-type";
import { fail, HttpError, ok } from "@/lib/http";
import { mediaListQuerySchema, mediaUploadFieldsSchema } from "@/lib/validators/media";
import { listMedia, uploadMedia, type UploadInput } from "@/services/media";

export const dynamic = "force-dynamic";

const MAX_FILES_PER_REQUEST = 10;
// Batas kasar seluruh body (semua file + overhead multipart), dicek sebelum body dibaca.
const MAX_BODY_BYTES = MAX_FILES_PER_REQUEST * MAX_UPLOAD_BYTES + 1024 * 1024;

export const GET = adminRoute(async (request) => {
  const query = mediaListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const { items, meta } = await listMedia(query);
  return ok(items, meta);
});

export const POST = adminRoute(async (request, _context, admin) => {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Total ukuran upload terlalu besar.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "INVALID_FORM", "Body harus multipart/form-data.");
  }

  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (files.length === 0) {
    throw new HttpError(422, "NO_FILES", "Pilih minimal satu file.", { files: ["Pilih minimal satu file."] });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    throw new HttpError(422, "TOO_MANY_FILES", `Maksimal ${MAX_FILES_PER_REQUEST} file per upload.`);
  }

  const folderValue = form.get("folder");
  const { folder } = mediaUploadFieldsSchema.parse({
    folder: typeof folderValue === "string" ? folderValue : undefined,
  });

  const inputs: UploadInput[] = [];
  const oversized: { name: string; code: string; message: string }[] = [];
  for (const file of files) {
    // Tolak sebelum dibaca ke memori kalau ukuran yang dilaporkan sudah melebihi batas.
    if (file.size > MAX_UPLOAD_BYTES) {
      oversized.push({ name: file.name, code: "FILE_TOO_LARGE", message: "Ukuran file maksimal 10 MB." });
      continue;
    }
    inputs.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
  }

  const result = await uploadMedia(inputs, { folder: folder ?? null, userId: admin.user.id });
  const failed = [...oversized, ...result.failed];

  if (result.created.length === 0) {
    const first = failed[0];
    return fail(422, first?.code ?? "UPLOAD_FAILED", first?.message ?? "Upload gagal.", undefined, {
      failed,
    });
  }
  return ok({ created: result.created, failed }, undefined, 201);
});
