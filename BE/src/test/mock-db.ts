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
    delete: vi.fn(),
    deleteMany: vi.fn(),
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
    $transaction: vi.fn(),
  };
}

export type MockDb = ReturnType<typeof createMockDb>;
