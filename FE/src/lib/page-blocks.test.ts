import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PageBlock } from "@/lib/api/types";
import {
  addBlock,
  blockIndexesFromFieldKeys,
  blockIndexesFromFormErrors,
  blockSummary,
  createBlock,
  FEATURES_MAX,
  LIST_ITEMS_MAX,
  MISSION_ITEMS_MAX,
  PAGE_BLOCK_TYPES,
  PAGE_BLOCKS_MAX,
  pageBlocksFormSchema,
  removeBlock,
  reorderBlocks,
  restoreBlock,
  updateBlock,
} from "@/lib/page-blocks";

const list = (id: string, items = ["a"]): PageBlock => ({ id, type: "LIST", eyebrow: "", heading: id, style: "bullet", items });
const ids = (blocks: PageBlock[]) => blocks.map((block) => block.id);

describe("batas blok sama dengan BE", () => {
  it("PAGE_BLOCKS_MAX, FEATURES_MAX, LIST_ITEMS_MAX, MISSION_ITEMS_MAX", () => {
    const be = (file: string) => readFileSync(path.resolve(__dirname, `../../../BE/src/lib/validators/${file}`), "utf8");
    const blocks = be("page-blocks.ts");
    expect(blocks).toMatch(new RegExp(`export const PAGE_BLOCKS_MAX = ${PAGE_BLOCKS_MAX};`));
    expect(blocks).toMatch(new RegExp(`export const FEATURES_MAX = ${FEATURES_MAX};`));
    expect(blocks).toMatch(new RegExp(`export const LIST_ITEMS_MAX = ${LIST_ITEMS_MAX};`));
    expect(be("content-common.ts")).toMatch(new RegExp(`export const MISSION_ITEMS_MAX = ${MISSION_ITEMS_MAX};`));
  });
});

describe("createBlock", () => {
  it.each(PAGE_BLOCK_TYPES)("%s: punya id dan default yang bisa langsung diedit", (type) => {
    const block = createBlock(type, "b1");
    expect(block).toMatchObject({ id: "b1", type });
  });

  it("id default berupa UUID unik", () => {
    const a = createBlock("LIST");
    const b = createBlock("LIST");
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
  });
});

describe("tambah, ubah, hapus, pulihkan, urutkan", () => {
  it("tambah di akhir; daftar penuh tidak berubah", () => {
    expect(ids(addBlock([list("a")], list("b")))).toEqual(["a", "b"]);
    const full = Array.from({ length: PAGE_BLOCKS_MAX }, (_, index) => list(`b${index}`));
    expect(addBlock(full, list("lebih"))).toBe(full);
  });

  it("ubah hanya blok dengan id yang sama", () => {
    const next = updateBlock([list("a"), list("b")], { ...list("b"), heading: "baru" } as PageBlock);
    expect(next.map((block) => (block.type === "LIST" ? block.heading : ""))).toEqual(["a", "baru"]);
  });

  it("hapus mengembalikan blok + posisinya; pulihkan ke posisi semula", () => {
    const blocks = [list("a"), list("b"), list("c")];
    const { blocks: after, removed } = removeBlock(blocks, "b");
    expect(ids(after)).toEqual(["a", "c"]);
    expect(removed).toEqual({ block: blocks[1], index: 1 });
    expect(ids(restoreBlock(after, removed!))).toEqual(["a", "b", "c"]);
  });

  it("hapus id yang tidak ada: tidak berubah", () => {
    const blocks = [list("a")];
    expect(removeBlock(blocks, "x")).toEqual({ blocks, removed: null });
  });

  it("pulihkan setelah daftar memendek: ke akhir; sudah ada: tidak dobel", () => {
    const removed = { block: list("z"), index: 5 };
    expect(ids(restoreBlock([list("a")], removed))).toEqual(["a", "z"]);
    expect(ids(restoreBlock([list("z")], removed))).toEqual(["z"]);
  });

  it("urutkan dari daftar id; id asing diabaikan, blok yang tidak disebut tetap ikut", () => {
    const blocks = [list("a"), list("b"), list("c")];
    expect(ids(reorderBlocks(blocks, ["c", "a", "b"]))).toEqual(["c", "a", "b"]);
    expect(ids(reorderBlocks(blocks, ["b", "x"]))).toEqual(["b", "a", "c"]);
  });
});

describe("pemetaan error ke blok", () => {
  it("key field API blocks.N.field -> index blok, unik dan terurut", () => {
    expect(
      blockIndexesFromFieldKeys(["title", "blocks.3.file", "blocks.0.items.2", "blocks.3.label", "blocks", "seo.title"]),
    ).toEqual([0, 3]);
    expect(blockIndexesFromFieldKeys(["blocks.12"])).toEqual([12]);
    expect(blockIndexesFromFieldKeys(["blocksX.1.a"])).toEqual([]);
  });

  it("objek error React Hook Form (array jarang) -> index blok", () => {
    const sparse: unknown[] = [];
    sparse[2] = { file: { message: "x" } };
    sparse[5] = { items: [{ message: "y" }] };
    expect(blockIndexesFromFormErrors(sparse)).toEqual([2, 5]);
    expect(blockIndexesFromFormErrors({ 1: { label: {} }, root: { message: "z" } })).toEqual([1]);
    expect(blockIndexesFromFormErrors(undefined)).toEqual([]);
  });

  it("validasi form memakai path yang sama dengan BE", () => {
    const result = pageBlocksFormSchema.safeParse([
      list("a"),
      { ...createBlock("DOWNLOAD", "b"), label: "" },
      createBlock("IMAGE", "c"),
      { ...createBlock("SERVICES", "d"), mode: "manual" },
    ]);
    expect(result.success).toBe(false);
    const keys = result.error?.issues.map((issue) => ["blocks", ...issue.path].join(".")) ?? [];
    expect(keys).toEqual(expect.arrayContaining(["blocks.1.label", "blocks.2.image", "blocks.3.ids"]));
    expect(blockIndexesFromFieldKeys(keys)).toEqual([1, 2, 3]);
  });
});

describe("blockSummary", () => {
  it("ringkasan kepala kartu", () => {
    expect(blockSummary(createBlock("SERVICES", "s"))).toBe("Otomatis, 4 layanan");
    expect(blockSummary(createBlock("IMAGE", "i"))).toBe("Belum ada gambar");
    expect(
      blockSummary({
        ...createBlock("RICH_TEXT", "r"),
        body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Tentang kami" }] }] },
      } as PageBlock),
    ).toBe("Tentang kami");
  });
});
