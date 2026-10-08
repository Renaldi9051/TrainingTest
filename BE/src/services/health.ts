import { db } from "@/lib/db";

export async function isDatabaseUp(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("Health check: database tidak dapat dihubungi", error);
    return false;
  }
}
