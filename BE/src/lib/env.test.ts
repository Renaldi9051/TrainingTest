import { describe, expect, it } from "vitest";
import { databaseName, parseE2eEnv, parseEnv, parseSeedEnv } from "@/lib/env";

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5433/training_dev",
  SESSION_SECRET: "x".repeat(32),
  UPLOAD_DIR: "./uploads",
  PUBLIC_BASE_URL: "http://localhost:3000",
  FE_REVALIDATE_URL: "http://localhost:3000/api/revalidate",
  REVALIDATE_SECRET: "y".repeat(16),
  ALLOWED_ORIGINS: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("menerima env yang lengkap", () => {
    expect(parseEnv(validEnv)).toEqual({
      ...validEnv,
      ALLOWED_ORIGINS: ["http://localhost:3000"],
      TRUST_PROXY_HOPS: 1,
    });
  });

  it("mewajibkan DATABASE_URL, termasuk menolak nilai kosong", () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("menerima skema postgres:// maupun postgresql://", () => {
    const url = "postgres://user:pass@localhost:5433/training_dev";
    expect(parseEnv({ ...validEnv, DATABASE_URL: url }).DATABASE_URL).toBe(url);
  });

  it("menolak DATABASE_URL yang bukan PostgreSQL", () => {
    expect(() =>
      parseEnv({ ...validEnv, DATABASE_URL: "mysql://user:pass@localhost:3306/training_dev" }),
    ).toThrow(/DATABASE_URL/);
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

  it("memecah ALLOWED_ORIGINS per koma dan menolak nilai yang bukan URL", () => {
    const env = parseEnv({
      ...validEnv,
      ALLOWED_ORIGINS: "http://localhost:3000, https://contoh.id",
    });
    expect(env.ALLOWED_ORIGINS).toEqual(["http://localhost:3000", "https://contoh.id"]);
    expect(() => parseEnv({ ...validEnv, ALLOWED_ORIGINS: "localhost" })).toThrow(
      /ALLOWED_ORIGINS/,
    );
    expect(() => parseEnv({ ...validEnv, ALLOWED_ORIGINS: undefined })).toThrow(/ALLOWED_ORIGINS/);
  });

  it("membaca TRUST_PROXY_HOPS sebagai angka", () => {
    expect(parseEnv({ ...validEnv, TRUST_PROXY_HOPS: "2" }).TRUST_PROXY_HOPS).toBe(2);
    expect(() => parseEnv({ ...validEnv, TRUST_PROXY_HOPS: "0" })).toThrow(/TRUST_PROXY_HOPS/);
  });
});

describe("parseSeedEnv", () => {
  const seedEnv = { ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "p".repeat(12), ADMIN_NAME: "Admin" };

  it("menerima env admin yang lengkap", () => {
    expect(parseSeedEnv(seedEnv)).toEqual(seedEnv);
  });

  it("menolak password pendek dan email tidak valid", () => {
    expect(() => parseSeedEnv({ ...seedEnv, ADMIN_PASSWORD: "pendek" })).toThrow(/ADMIN_PASSWORD/);
    expect(() => parseSeedEnv({ ...seedEnv, ADMIN_EMAIL: "bukan-email" })).toThrow(/ADMIN_EMAIL/);
  });
});

describe("parseE2eEnv", () => {
  it("hanya menerima database bernama training_e2e", () => {
    const url = "postgresql://user:pass@localhost:5433/training_e2e";
    expect(parseE2eEnv({ DATABASE_URL_E2E: url }).DATABASE_URL_E2E).toBe(url);
    for (const name of ["training_dev", "training_prod", "training_e2e_x", "postgres", ""]) {
      expect(() =>
        parseE2eEnv({ DATABASE_URL_E2E: `postgresql://user:pass@localhost:5433/${name}` }),
      ).toThrow(/training_e2e/);
    }
  });

  it("mewajibkan DATABASE_URL_E2E dan menolak selain PostgreSQL", () => {
    expect(() => parseE2eEnv({})).toThrow(/DATABASE_URL_E2E/);
    expect(() => parseE2eEnv({ DATABASE_URL_E2E: "mysql://u:p@localhost:3306/training_e2e" })).toThrow(
      /DATABASE_URL_E2E/,
    );
  });

  it("membaca nama database dari URL, termasuk dengan query string", () => {
    expect(databaseName("postgresql://u:p@localhost:5433/training_e2e?schema=public")).toBe("training_e2e");
  });
});
