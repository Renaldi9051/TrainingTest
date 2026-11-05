import { describe, expect, it } from "vitest";
import { aggregateAudience, normalizeRoleKey, splitRoles } from "@/services/category-audience";

describe("splitRoles", () => {
  it("memecah pada koma, titik koma, garis miring, dan baris baru", () => {
    expect(splitRoles("Staf, Supervisor; Manajer / Direktur\nAuditor")).toEqual([
      "Staf",
      "Supervisor",
      "Manajer",
      "Direktur",
      "Auditor",
    ]);
  });

  it("TIDAK memecah pada 'dan' atau '&' (bagian dari frasa peran utuh)", () => {
    expect(splitRoles("Staf administrasi dan tata usaha")).toEqual(["Staf administrasi dan tata usaha"]);
    expect(splitRoles("Sekretaris & asisten pimpinan")).toEqual(["Sekretaris & asisten pimpinan"]);
  });

  it("membuang bagian kosong dan merapikan spasi tepi", () => {
    expect(splitRoles("Staf ,, Supervisor ,")).toEqual(["Staf", "Supervisor"]);
  });
});

describe("normalizeRoleKey", () => {
  it("lowercase id-ID, rapikan spasi, buang tanda baca di ujung", () => {
    expect(normalizeRoleKey("  Staf  Administrasi.  ")).toBe("staf administrasi");
    expect(normalizeRoleKey("Supervisor!")).toBe("supervisor");
    expect(normalizeRoleKey("(Manajer)")).toBe("manajer");
  });

  it("peran yang hanya beda huruf besar/kecil & tanda baca ujung dianggap sama", () => {
    expect(normalizeRoleKey("Staf Administrasi")).toBe(normalizeRoleKey("staf administrasi."));
  });
});

describe("aggregateAudience", () => {
  it("menghitung per pelatihan (bukan per kemunculan) dan menggabung peran yang sama", () => {
    const result = aggregateAudience([
      [{ role: "Staf administrasi" }, { role: "Supervisor" }],
      [{ role: "staf administrasi." }], // varian sama -> digabung
      [{ role: "Supervisor" }, { role: "Manajer" }],
    ]);
    expect(result).toEqual([
      { label: "Staf administrasi", trainingCount: 2 },
      { label: "Supervisor", trainingCount: 2 },
      { label: "Manajer", trainingCount: 1 },
    ]);
  });

  it("peran dobel dalam satu pelatihan tetap dihitung sekali", () => {
    const result = aggregateAudience([[{ role: "Staf" }, { role: "staf" }, { role: "STAF." }]]);
    expect(result).toEqual([{ label: "Staf", trainingCount: 1 }]);
  });

  it("label tampilan = varian yang paling sering muncul", () => {
    const result = aggregateAudience([
      [{ role: "staf administrasi" }],
      [{ role: "Staf Administrasi" }],
      [{ role: "Staf Administrasi" }],
    ]);
    expect(result[0]).toEqual({ label: "Staf Administrasi", trainingCount: 3 });
  });

  it("urut jumlah pelatihan turun, lalu label naik; dipotong ke maks", () => {
    const result = aggregateAudience(
      [
        [{ role: "B" }, { role: "A" }],
        [{ role: "A" }],
        [{ role: "C" }],
      ],
      2,
    );
    expect(result).toEqual([
      { label: "A", trainingCount: 2 },
      { label: "B", trainingCount: 1 },
    ]);
  });

  it("memecah role majemuk dengan pemisah daftar lalu mengagregasi", () => {
    const result = aggregateAudience([[{ role: "Staf, Supervisor" }], [{ role: "Supervisor" }]]);
    expect(result).toEqual([
      { label: "Supervisor", trainingCount: 2 },
      { label: "Staf", trainingCount: 1 },
    ]);
  });
});
