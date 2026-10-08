import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5433/training_dev",
  SESSION_SECRET: "x".repeat(32),
  UPLOAD_DIR: "./uploads",
  PUBLIC_BASE_URL: "http://localhost:3000",
  FE_REVALIDATE_URL: "http://localhost:3000/api/revalidate",
  REVALIDATE_SECRET: "y".repeat(16),
};

describe("parseEnv", () => {
  it("menerima env yang lengkap", () => {
    expect(parseEnv(validEnv)).toEqual(validEnv);
  });

  it("menganggap DATABASE_URL opsional, termasuk nilai kosong", () => {
    expect(parseEnv({ ...validEnv, DATABASE_URL: undefined }).DATABASE_URL).toBeUndefined();
    expect(parseEnv({ ...validEnv, DATABASE_URL: "" }).DATABASE_URL).toBeUndefined();
  });

  it("menolak SESSION_SECRET yang terlalu pendek", () => {
    expect(() => parseEnv({ ...validEnv, SESSION_SECRET: "pendek" })).toThrow(/SESSION_SECRET/);
  });

  it("menolak URL yang tidak valid", () => {
    expect(() => parseEnv({ ...validEnv, PUBLIC_BASE_URL: "bukan-url" })).toThrow(/PUBLIC_BASE_URL/);
  });

  it("menolak variabel wajib yang hilang", () => {
    expect(() => parseEnv({ ...validEnv, REVALIDATE_SECRET: undefined })).toThrow(
      /REVALIDATE_SECRET/,
    );
  });
});
