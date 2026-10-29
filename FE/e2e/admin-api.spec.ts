import { expect, test } from "@playwright/test";
import { ORIGIN } from "./helpers";

// Semua endpoint /api/admin/* menolak request tanpa sesi (401), termasuk mutasi.
const ZERO_ID = "00000000-0000-7000-8000-000000000000";

type Endpoint = [method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string];

// Entitas konten dengan pola list/create, detail/ubah/hapus, restore, plus route opsional.
function contentEndpoints(name: string, extra: { options?: boolean; reorder?: boolean; preview?: string }): Endpoint[] {
  const base = `/api/admin/${name}`;
  return [
    ["GET", base],
    ["POST", base],
    ["GET", `${base}/${ZERO_ID}`],
    ["PATCH", `${base}/${ZERO_ID}`],
    ["DELETE", `${base}/${ZERO_ID}`],
    ["POST", `${base}/${ZERO_ID}/restore`],
    ...(extra.options ? [["GET", `${base}/options`] satisfies Endpoint] : []),
    ...(extra.reorder ? [["POST", `${base}/reorder`] satisfies Endpoint] : []),
    ...(extra.preview ? [["GET", `${base}${extra.preview}`] satisfies Endpoint] : []),
  ];
}

const endpoints: Endpoint[] = [
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
  // Fase 1
  ["GET", "/api/admin/dashboard"],
  ["GET", "/api/admin/media"],
  ["POST", "/api/admin/media"],
  ["GET", "/api/admin/media/folders"],
  ["GET", `/api/admin/media/${ZERO_ID}`],
  ["PATCH", `/api/admin/media/${ZERO_ID}`],
  ["DELETE", `/api/admin/media/${ZERO_ID}`],
  // Fase 3
  ...contentEndpoints("services", { options: true, reorder: true, preview: "/preview/x" }),
  ...contentEndpoints("clients", { options: true, reorder: true }),
  ...contentEndpoints("testimonials", { options: true, reorder: true }),
  ...contentEndpoints("portfolio", { options: true, reorder: true }),
  ...contentEndpoints("marketing", { options: true, reorder: true }),
  ...contentEndpoints("pages", { preview: "/preview/x" }),
  ...contentEndpoints("home-sections", { reorder: true, preview: "/preview" }),
];

test("semua endpoint admin tanpa sesi = 401", async ({ request }) => {
  // BE e2e memakai `next dev`: setiap route dikompilasi saat pertama diakses, jadi butuh waktu lebih.
  test.setTimeout(300_000);
  const failures: string[] = [];
  for (const [method, path] of endpoints) {
    const response = await request.fetch(path, { method, headers: { Origin: ORIGIN }, data: method === "GET" ? undefined : {} });
    if (response.status() !== 401) failures.push(`${method} ${path} -> ${response.status()}`);
  }
  expect(failures).toEqual([]);
});
