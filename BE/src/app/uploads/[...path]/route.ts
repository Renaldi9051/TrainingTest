import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { contentTypeFor, getR2Object, isSafeRelativePath, r2Config, resolveUploadPath, uploadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
}

// Nama file acak dan tidak pernah ditimpa, jadi aman di-cache selamanya.
function fileHeaders(contentType: string, size: string | null): Headers {
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  if (size) headers.set("Content-Length", size);
  if (contentType === "image/svg+xml") {
    // Lapisan kedua setelah sanitasi: SVG yang dibuka langsung tidak bisa menjalankan script.
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
  if (contentType === "application/pdf") headers.set("Content-Disposition", "inline");
  return headers;
}

// Melayani file upload dari disk (UPLOAD_DIR) atau dari bucket R2.
export async function GET(_request: Request, context: RouteContext<"/uploads/[...path]">) {
  const segments = (await context.params).path;
  const relativePath = segments.join("/");
  const contentType = contentTypeFor(relativePath);
  if (!contentType) return notFound();

  const r2 = r2Config();
  if (r2) {
    if (!isSafeRelativePath(relativePath)) return notFound();
    // R2 dengan domain publik: link /uploads lama (HTML ter-cache, tautan luar) diteruskan ke domain bucket.
    if (r2.publicUrl) {
      return new Response(null, {
        status: 308,
        headers: { Location: uploadUrl(relativePath, r2), "Cache-Control": "public, max-age=86400" },
      });
    }
    // Tanpa domain publik: file diambil dari bucket dan diteruskan apa adanya (disk VPS tidak dipakai).
    const object = await getR2Object(r2, relativePath);
    if (!object?.body) return notFound();
    return new Response(object.body, {
      status: 200,
      headers: fileHeaders(contentType, object.headers.get("Content-Length")),
    });
  }

  const absolutePath = resolveUploadPath(relativePath);
  if (!absolutePath) return notFound();

  let size: number;
  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) return notFound();
    size = info.size;
  } catch {
    return notFound();
  }

  const stream = Readable.toWeb(createReadStream(absolutePath)) as ReadableStream<Uint8Array>;
  return new Response(stream, { status: 200, headers: fileHeaders(contentType, String(size)) });
}
