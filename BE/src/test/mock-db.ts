import { vi } from "vitest";

// Mock Prisma minimal untuk unit test service. Tiap test mengatur nilai balik lewat mockResolvedValue.
export function createMockDb() {
  const model = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  });
  return {
    user: model(),
    session: model(),
    auditLog: model(),
    media: model(),
    training: model(),
    category: model(),
    schedule: model(),
    service: model(),
    client: model(),
    testimonial: model(),
    marketingContact: model(),
    portfolioImage: model(),
    siteSetting: model(),
    navItem: model(),
    redirect: model(),
    trainingCategory: model(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
}

// $transaction(callback) memakai mock yang sama sebagai client transaksi;
// $transaction([...]) menjalankan semua promise.
export function passThroughTransactions(mock: ReturnType<typeof createMockDb>) {
  mock.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: unknown) => Promise<unknown>)(mock);
    return Promise.all(arg as Promise<unknown>[]);
  });
}

export type MockDb = ReturnType<typeof createMockDb>;
