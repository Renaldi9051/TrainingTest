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
      RATE_LIMIT_UNKNOWN_IP: "shared",
    });
  });

  describe("Cloudflare R2", () => {
    const r2Env = {
      R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "secret-key",
      R2_BUCKET: "training-media",
      R2_PUBLIC_URL: "https://media.contoh.id",
    };

    it("opsional: semua kosong (\"R2_BUCKET=\" di .env) dianggap tidak diisi", () => {
      const env = parseEnv({
        ...validEnv,
        R2_ACCOUNT_ID: "",
        R2_ACCESS_KEY_ID: "",
        R2_SECRET_ACCESS_KEY: "",
        R2_BUCKET: "",
        R2_PUBLIC_URL: "",
      });
      expect(env.R2_BUCKET).toBeUndefined();
      expect(env.R2_PUBLIC_URL).toBeUndefined();
    });

    it("menerima semua variabel R2 terisi", () => {
      expect(parseEnv({ ...validEnv, ...r2Env })).toMatchObject(r2Env);
    });

    it("R2_PUBLIC_URL opsional: kredensial & bucket saja sudah cukup", () => {
      expect(parseEnv({ ...validEnv, ...r2Env, R2_PUBLIC_URL: "" }).R2_PUBLIC_URL).toBeUndefined();
    });

    it("menolak kalau kredensial & bucket hanya sebagian yang diisi", () => {
      expect(() => parseEnv({ ...validEnv, ...r2Env, R2_SECRET_ACCESS_KEY: "" })).toThrow(/R2_SECRET_ACCESS_KEY/);
      expect(() => parseEnv({ ...validEnv, R2_BUCKET: "training-media" })).toThrow(/R2_ACCOUNT_ID/);
      expect(() => parseEnv({ ...validEnv, R2_PUBLIC_URL: "https://media.contoh.id" })).toThrow(/R2_BUCKET/);
    });

    it("menolak R2_PUBLIC_URL bergaris miring di akhir dan Account ID yang bukan hex 32", () => {
      expect(() => parseEnv({ ...validEnv, ...r2Env, R2_PUBLIC_URL: "https://media.contoh.id/" })).toThrow(/R2_PUBLIC_URL/);
      expect(() => parseEnv({ ...validEnv, ...r2Env, R2_ACCOUNT_ID: "bukan-id" })).toThrow(/R2_ACCOUNT_ID/);
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

  it("RATE_LIMIT_UNKNOWN_IP: default shared, menerima skip, menolak nilai lain", () => {
    expect(parseEnv(validEnv).RATE_LIMIT_UNKNOWN_IP).toBe("shared");
    expect(parseEnv({ ...validEnv, RATE_LIMIT_UNKNOWN_IP: "skip" }).RATE_LIMIT_UNKNOWN_IP).toBe("skip");
    expect(() => parseEnv({ ...validEnv, RATE_LIMIT_UNKNOWN_IP: "off" })).toThrow(/RATE_LIMIT_UNKNOWN_IP/);
  });
});

describe("parseSeedEnv", () => {
  const seedEnv = { ADMIN_PASSWORD: "p".repeat(12), ADMIN_NAME: "Admin" };

  it("menerima env admin yang lengkap", () => {
    expect(parseSeedEnv(seedEnv)).toEqual(seedEnv);
  });

  it("menolak password di bawah 12 karakter", () => {
    expect(() => parseSeedEnv({ ...seedEnv, ADMIN_PASSWORD: "p".repeat(11) })).toThrow(/ADMIN_PASSWORD/);
  });

  it("ADMIN_EMAIL tidak wajib lagi dan diabaikan kalau masih ada di .env lama", () => {
    expect(parseSeedEnv({ ...seedEnv, ADMIN_EMAIL: "bukan-email" })).toEqual(seedEnv);
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
