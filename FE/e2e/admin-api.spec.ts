import { expect, test } from "@playwright/test";
import { ORIGIN } from "./helpers";

// Semua endpoint /api/admin/* Fase 2 menolak request tanpa sesi (401), termasuk mutasi.
const ZERO_ID = "00000000-0000-7000-8000-000000000000";

const endpoints: [method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string][] = [
  ["GET", "/api/admin/settings"],
  ["PUT", "/api/admin/settings/site.identity"],
  ["GET", "/api/admin/nav"],
  ["POST", "/api/admin/nav"],
  ["PATCH", `/api/admin/nav/${ZERO_ID}`],
  ["DELETE", `/api/admin/nav/${ZERO_ID}`],
  ["POST", `/api/admin/nav/${ZERO_ID}/restore`],
  ["POST", "/api/admin/nav/reorder"],
  ["GET", "/api/admin/categories"],
  ["GET", "/api/admin/categories/options"],
  ["POST", "/api/admin/categories"],
  ["GET", `/api/admin/categories/${ZERO_ID}`],
  ["PATCH", `/api/admin/categories/${ZERO_ID}`],
  ["DELETE", `/api/admin/categories/${ZERO_ID}`],
  ["POST", `/api/admin/categories/${ZERO_ID}/restore`],
  ["POST", "/api/admin/categories/reorder"],
  ["GET", "/api/admin/slugs/check?entity=training&slug=x"],
  ["GET", "/api/admin/trainings"],
  ["POST", "/api/admin/trainings"],
  ["GET", `/api/admin/trainings/${ZERO_ID}`],
  ["PATCH", `/api/admin/trainings/${ZERO_ID}`],
  ["DELETE", `/api/admin/trainings/${ZERO_ID}`],
  ["POST", `/api/admin/trainings/${ZERO_ID}/restore`],
  ["POST", `/api/admin/trainings/${ZERO_ID}/duplicate`],
  ["POST", "/api/admin/trainings/bulk"],
  ["GET", "/api/admin/trainings/preview/kpi"],
  ["GET", "/api/admin/schedules"],
  ["POST", "/api/admin/schedules"],
  ["GET", `/api/admin/schedules/${ZERO_ID}`],
  ["PATCH", `/api/admin/schedules/${ZERO_ID}`],
  ["DELETE", `/api/admin/schedules/${ZERO_ID}`],
  ["POST", `/api/admin/schedules/${ZERO_ID}/restore`],
  ["POST", "/api/admin/schedules/import"],
  ["GET", "/api/admin/schedules/import-template"],
];

test("endpoint admin Fase 2 tanpa sesi = 401", async ({ request }) => {
  const failures: string[] = [];
  for (const [method, path] of endpoints) {
    const response = await request.fetch(path, { method, headers: { Origin: ORIGIN }, data: method === "GET" ? undefined : {} });
    if (response.status() !== 401) failures.push(`${method} ${path} -> ${response.status()}`);
  }
  expect(failures).toEqual([]);
});
