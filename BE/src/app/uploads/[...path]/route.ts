import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { contentTypeFor, resolveUploadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
}

// Melayani file upload. Nama file acak dan tidak pernah ditimpa, jadi aman di-cache selamanya.
export async function GET(_request: Request, context: RouteContext<"/uploads/[...path]">) {
  const segments = (await context.params).path;
  const relativePath = segments.join("/");
  const absolutePath = resolveUploadPath(relativePath);
  const contentType = contentTypeFor(relativePath);
  if (!absolutePath || !contentType) return notFound();

  let size: number;
  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) return notFound();
    size = info.size;
  } catch {
    return notFound();
  }

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(size),
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
  });
  if (contentType === "image/svg+xml") {
    // Lapisan kedua setelah sanitasi: SVG yang dibuka langsung tidak bisa menjalankan script.
    headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  }
  if (contentType === "application/pdf") headers.set("Content-Disposition", "inline");

  const stream = Readable.toWeb(createReadStream(absolutePath)) as ReadableStream<Uint8Array>;
  return new Response(stream, { status: 200, headers });
}
