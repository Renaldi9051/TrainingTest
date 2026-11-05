import { describe, expect, it } from "vitest";
import { assertBackfillTarget, BackfillGuardError } from "./backfill-guard";

describe("assertBackfillTarget", () => {
  it("tanpa --production: hanya training_dev", () => {
    expect(assertBackfillTarget({ databaseName: "training_dev", production: false, confirmDbName: undefined })).toEqual({ mode: "dev" });
    for (const name of ["training_prod", "training_e2e", "lain"]) {
      expect(() => assertBackfillTarget({ databaseName: name, production: false, confirmDbName: undefined })).toThrow(BackfillGuardError);
    }
  });

  it("tanpa --production: CONFIRM_DB_NAME tidak membuka database lain", () => {
    expect(() => assertBackfillTarget({ databaseName: "training_prod", production: false, confirmDbName: "training_prod" })).toThrow(
      BackfillGuardError,
    );
  });

  it("--production tanpa CONFIRM_DB_NAME (kosong/tidak diisi) ditolak", () => {
    for (const confirmDbName of [undefined, ""]) {
      expect(() => assertBackfillTarget({ databaseName: "training_prod", production: true, confirmDbName })).toThrow(/CONFIRM_DB_NAME/);
    }
  });

  it("--production dengan CONFIRM_DB_NAME yang berbeda (termasuk beda huruf/spasi) ditolak", () => {
    for (const confirmDbName of ["training_dev", "TRAINING_PROD", "training_prod ", "training"]) {
      expect(() => assertBackfillTarget({ databaseName: "training_prod", production: true, confirmDbName })).toThrow(/tidak sama persis/);
    }
  });

  it("--production dengan CONFIRM_DB_NAME sama persis = mode production", () => {
    expect(assertBackfillTarget({ databaseName: "training_prod", production: true, confirmDbName: "training_prod" })).toEqual({
      mode: "production",
    });
  });

  it("nama database tidak terbaca selalu ditolak", () => {
    expect(() => assertBackfillTarget({ databaseName: "", production: true, confirmDbName: "" })).toThrow(/tidak terbaca/);
    expect(() => assertBackfillTarget({ databaseName: "", production: false, confirmDbName: undefined })).toThrow(/tidak terbaca/);
  });
});
