import { beforeEach, describe, expect, it, vi } from "vitest";

// Penjaga script reset e2e: database selain training_e2e ditolak sebelum koneksi dibuka atau
// perintah apa pun dijalankan. pg dan child_process di-mock, jadi tidak ada database yang tersentuh.
const queries = vi.hoisted(() => [] as string[]);
const clients = vi.hoisted(() => ({ created: 0 }));
vi.mock("pg", () => ({
  Client: class {
    constructor() {
      clients.created += 1;
    }
    async connect() {}
    async end() {}
    async query(sql: string) {
      queries.push(sql);
      return { rowCount: 0 };
    }
  },
}));
const spawnSync = vi.hoisted(() => vi.fn(() => ({ status: 0 })));
vi.mock("node:child_process", () => ({ spawnSync }));

import { ensureE2eDatabase, recreateE2eDatabase, runWithDatabase } from "./e2e-shared";

const url = (name: string) => `postgresql://user:pass@localhost:5433/${name}`;

beforeEach(() => {
  queries.length = 0;
  clients.created = 0;
  spawnSync.mockClear();
});

describe("guard database e2e", () => {
  it.each(["training_dev", "training_prod", "postgres", "training_e2e_lain"])(
    "menolak %s sebelum membuka koneksi atau menjalankan perintah",
    async (name) => {
      await expect(recreateE2eDatabase(url(name))).rejects.toThrow(`database "${name}" bukan training_e2e`);
      await expect(ensureE2eDatabase(url(name))).rejects.toThrow(/bukan training_e2e/);
      expect(() => runWithDatabase("npx prisma migrate deploy", url(name))).toThrow(/bukan training_e2e/);
      expect(clients.created).toBe(0);
      expect(queries).toEqual([]);
      expect(spawnSync).not.toHaveBeenCalled();
    },
  );

  it("training_e2e: hanya database itu yang di-drop dan dibuat ulang", async () => {
    await recreateE2eDatabase(url("training_e2e"));
    expect(queries).toEqual(['DROP DATABASE IF EXISTS "training_e2e" WITH (FORCE)', 'CREATE DATABASE "training_e2e"']);
  });

  it("training_e2e: perintah dijalankan dengan DATABASE_URL e2e", () => {
    runWithDatabase("npx prisma db seed", url("training_e2e"));
    expect(spawnSync).toHaveBeenCalledWith(
      "npx prisma db seed",
      expect.objectContaining({ env: expect.objectContaining({ DATABASE_URL: url("training_e2e") }) }),
    );
  });
});
