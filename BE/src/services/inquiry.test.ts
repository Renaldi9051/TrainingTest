import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));

import { MemoryRateLimiter } from "@/lib/rate-limit";
import { inquiryCreateSchema } from "@/lib/validators/inquiry";
import { createInquiry, exportInquiries, purgeExpiredInquiries } from "@/services/inquiry";
import type { InquiryNotifier } from "@/services/inquiry-notify";

const now = new Date("2026-10-13T03:00:00Z");
const TRAINING = "pilot-drone-dasar";
let mock: MockDb;
const notifier: InquiryNotifier & { notify: ReturnType<typeof vi.fn> } = { notify: vi.fn(async () => {}) };

const limiters = () => ({ ip: new MemoryRateLimiter(5, 10 * 60_000), email: new MemoryRateLimiter(3, 60 * 60_000) });
const input = (extra: Record<string, unknown> = {}) =>
  inquiryCreateSchema.parse({ name: "Rina Contoh", email: "rina@example.com", consent: true, ...extra });
const row = (data: Record<string, unknown>) => ({
  id: "i1",
  company: null,
  phone: null,
  trainingId: null,
  training: null,
  interest: null,
  message: null,
  source: "CONTACT",
  status: "NEW",
  note: null,
  consentAt: now,
  consentVersion: "2026-10",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  updatedById: null,
  ...data,
});

beforeEach(() => {
  mock = createMockDb();
  passThroughTransactions(mock);
  db.current = mock;
  notifier.notify.mockClear();
  mock.inquiry.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(data));
  mock.inquiry.findMany.mockResolvedValue([]);
  mock.inquiry.deleteMany.mockResolvedValue({ count: 0 });
});

describe("createInquiry", () => {
  it("menyimpan persetujuan (waktu + versi) dan memanggil notifier", async () => {
    const result = await createInquiry(input(), { ip: "1.1.1.1" }, now, limiters(), notifier);
    expect(result.id).toBe("i1");
    const data = mock.inquiry.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: "rina@example.com", consentAt: now, consentVersion: "2026-10", trainingId: null });
    expect(notifier.notify).toHaveBeenCalledTimes(1);
  });

  it("honeypot terisi: dibalas seperti sukses, tidak disimpan, tidak memakai jatah", async () => {
    const limit = limiters();
    const result = await createInquiry(input({ website: "https://spam.example" }), { ip: "1.1.1.1" }, now, limit, notifier);
    expect(result).toEqual({ id: null });
    expect(mock.inquiry.create).not.toHaveBeenCalled();
    expect(limit.ip.status("1.1.1.1", now.getTime()).blocked).toBe(false);
  });

  it("rate limit: kiriman ke-6 per IP dalam 10 menit = 429 + Retry-After", async () => {
    const limit = limiters();
    for (let i = 0; i < 5; i++) {
      await createInquiry(input({ email: `orang${i}@example.com` }), { ip: "2.2.2.2" }, now, limit, notifier);
    }
    await expect(createInquiry(input({ email: "lain@example.com" }), { ip: "2.2.2.2" }, now, limit, notifier)).rejects.toMatchObject({
      status: 429,
      code: "TOO_MANY_REQUESTS",
      headers: { "Retry-After": "600" },
    });
    // IP lain tetap bisa.
    await expect(createInquiry(input({ email: "lain@example.com" }), { ip: "3.3.3.3" }, now, limit, notifier)).resolves.toBeTruthy();
  });

  it("rate limit: kiriman ke-4 per email dalam 1 jam = 429 walau IP berbeda", async () => {
    const limit = limiters();
    for (let i = 0; i < 3; i++) await createInquiry(input(), { ip: `4.4.4.${i}` }, now, limit, notifier);
    await expect(createInquiry(input(), { ip: "4.4.4.9" }, now, limit, notifier)).rejects.toMatchObject({ status: 429 });
    const later = new Date(now.getTime() + 61 * 60_000);
    await expect(createInquiry(input(), { ip: "4.4.4.9" }, later, limit, notifier)).resolves.toBeTruthy();
  });

  it("pelatihan draf/tidak tayang: trainingId disimpan null", async () => {
    mock.training.findFirst.mockResolvedValue(null);
    await createInquiry(input({ trainingSlug: TRAINING, source: "TRAINING_DETAIL" }), { ip: "5.5.5.5" }, now, limiters(), notifier);
    const where = mock.training.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ slug: TRAINING, status: "PUBLISHED", deletedAt: null });
    expect(mock.inquiry.create.mock.calls[0][0].data.trainingId).toBeNull();
  });

  it("notifikasi gagal tidak menggagalkan kiriman", async () => {
    notifier.notify.mockRejectedValueOnce(new Error("SMTP mati"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(createInquiry(input(), { ip: "6.6.6.6" }, now, limiters(), notifier)).resolves.toEqual({ id: "i1" });
    await Promise.resolve();
    warn.mockRestore();
  });
});

describe("exportInquiries", () => {
  it("CSV aman, filter tanggal WIB, ekspor di-audit tanpa isi data", async () => {
    mock.inquiry.findMany.mockResolvedValue([
      row({ name: "=cmd|' /C calc'!A0", email: "x@example.com", phone: "6281234567890", message: "Halo; apa kabar" }),
    ]);
    const result = await exportInquiries({ from: "2026-10-01", to: "2026-10-13" }, "u1", now);
    expect(result.filename).toBe("inquiry-2026-10-13.csv");
    expect(result.body.startsWith("\uFEFF")).toBe(true);
    expect(result.body).toContain(`"'=cmd|' /C calc'!A0"`);
    expect(result.body).toContain('"Halo; apa kabar"');
    const where = mock.inquiry.findMany.mock.calls[0][0].where;
    expect(where.createdAt).toEqual({ gte: new Date("2026-09-30T17:00:00Z"), lt: new Date("2026-10-13T17:00:00Z") });
    const audit = mock.auditLog.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ action: "EXPORT", entity: "Inquiry" });
    expect(JSON.stringify(audit.diff)).not.toContain("x@example.com");
  });
});

describe("purgeExpiredInquiries", () => {
  it("hapus permanen > 24 bulan sejak diubah dan Sampah > 30 hari; hanya jumlah yang dicatat", async () => {
    mock.inquiry.deleteMany.mockResolvedValue({ count: 2 });
    expect(await purgeExpiredInquiries(now)).toBe(2);
    const where = mock.inquiry.deleteMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { updatedAt: { lt: new Date("2024-10-13T03:00:00Z") } },
      { deletedAt: { lt: new Date("2026-09-13T03:00:00Z") } },
    ]);
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({ entity: "InquiryPurge", diff: { count: 2 } });
  });
});
