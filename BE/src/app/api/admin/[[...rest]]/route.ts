import { adminRoute } from "@/lib/auth";
import { fail } from "@/lib/http";

// Path /api/admin/* yang belum punya route: sesi tetap dicek dulu, jadi tanpa sesi = 401, bukan 404.
const notFound = adminRoute(async () => fail(404, "NOT_FOUND", "Endpoint tidak ditemukan."));

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
