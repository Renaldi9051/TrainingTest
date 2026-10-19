import { describe, expect, it } from "vitest";
import { collectMediaRefs } from "@/lib/media-refs";
import {
  PAGE_BLOCK_TYPES,
  PAGE_BLOCKS_MAX,
  pageBlockMediaRefs,
  pageBlockSchema,
  pageBlocksSchema,
  parseStoredBlocks,
  type PageBlockType,
} from "@/lib/validators/page-blocks";

const id = (n: number) => `0199b4d0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const MEDIA_IMAGE = "0199b4d0-0000-7000-8000-0000000000aa";
const MEDIA_PDF = "0199b4d0-0000-7000-8000-0000000000bb";
const SERVICE_ID = "0199b4d0-0000-7000-8000-0000000000cc";

const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });

// Contoh blok terlengkap per type.
const FULL: Record<PageBlockType, Record<string, unknown>> = {
  RICH_TEXT: { eyebrow: "01 / Tentang", heading: "Tentang kami", body: doc("Kami penyedia pelatihan.") },
  VISION_MISSION: { vision: "Menjadi mitra belajar.", mission: ["Satu"], motto: "Belajar terus" },
  FEATURES: { heading: "Keunggulan", items: [{ title: "Trainer praktisi", description: "x", icon: "users" }] },
  LIST: { heading: "Target peserta", style: "chips", items: ["Manajer", "Supervisor"] },
  SERVICES: { heading: "Layanan", mode: "manual", ids: [SERVICE_ID] },
  IMAGE: { image: { mediaId: MEDIA_IMAGE }, caption: "Kegiatan" },
  DOWNLOAD: { heading: "Company profile", label: "Unduh PDF", file: { mediaId: MEDIA_PDF } },
  PAYMENT_ACCOUNTS: {
    heading: "Rekening pembayaran",
    intro: "Transfer sesuai nominal di surat penawaran.",
    accounts: [
      { bank: "Bank Contoh", number: "123 456 7890", holder: "PT Contoh", note: "Pelatihan public", logo: { mediaId: MEDIA_IMAGE } },
      { bank: "Bank Lain", number: "0987-654-321", holder: "PT Contoh" },
    ],
    confirm: { label: "Konfirmasi pembayaran", href: "https://wa.me/6281200000000" },
  },
};

const fullBlocks = () => PAGE_BLOCK_TYPES.map((type, index) => ({ id: id(index + 1), type, ...FULL[type] }));

describe("pageBlockSchema", () => {
  it("setiap type punya contoh lengkap yang valid", () => {
    for (const block of fullBlocks()) {
      const result = pageBlockSchema.safeParse(block);
      expect(result.success, `${block.type}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it("default diisi", () => {
    expect(pageBlockSchema.parse({ id: id(1), type: "LIST", items: ["a"] })).toMatchObject({
      eyebrow: "",
      heading: "",
      style: "bullet",
    });
    expect(pageBlockSchema.parse({ id: id(1), type: "DOWNLOAD", label: "Unduh" })).toMatchObject({ file: null });
    expect(pageBlockSchema.parse({ id: id(1), type: "FEATURES", items: [{ title: "x" }] })).toMatchObject({
      items: [{ title: "x", description: "", icon: null }],
    });
    expect(
      pageBlockSchema.parse({ id: id(1), type: "PAYMENT_ACCOUNTS", accounts: [{ bank: " B ", number: " 123 ", holder: "PT" }] }),
    ).toMatchObject({ intro: "", confirm: null, accounts: [{ bank: "B", number: "123", note: "", logo: null }] });
  });

  it.each([
    ["type tidak dikenal", { id: id(1), type: "HTML", html: "<script>" }, []],
    ["id bukan uuid", { id: "blok-1", type: "LIST", items: ["a"] }, ["id"]],
    ["RICH_TEXT kosong", { id: id(1), type: "RICH_TEXT", body: { type: "doc", content: [] } }, ["body"]],
    [
      "RICH_TEXT link javascript:",
      {
        id: id(1),
        type: "RICH_TEXT",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }],
            },
          ],
        },
      },
      ["body", "content", 0, "content", 0, "marks", 0, "attrs", "href"],
    ],
    [
      "RICH_TEXT node di luar allowlist",
      { id: id(1), type: "RICH_TEXT", body: { type: "doc", content: [{ type: "image", attrs: { src: "x" } }] } },
      ["body", "content", 0, "type"],
    ],
    ["FEATURES ikon asing", { id: id(1), type: "FEATURES", items: [{ title: "x", icon: "skull" }] }, ["items", 0, "icon"]],
    ["FEATURES kosong", { id: id(1), type: "FEATURES", items: [] }, ["items"]],
    ["LIST gaya asing", { id: id(1), type: "LIST", style: "table", items: ["a"] }, ["style"]],
    ["SERVICES manual tanpa pilihan", { id: id(1), type: "SERVICES", mode: "manual" }, ["ids"]],
    ["IMAGE tanpa gambar", { id: id(1), type: "IMAGE" }, ["image"]],
    ["IMAGE gambar null", { id: id(1), type: "IMAGE", image: null }, ["image"]],
    ["DOWNLOAD tanpa label", { id: id(1), type: "DOWNLOAD", file: null }, ["label"]],
    ["VISION_MISSION tanpa visi", { id: id(1), type: "VISION_MISSION", mission: ["a"] }, ["vision"]],
    ["PAYMENT_ACCOUNTS tanpa rekening", { id: id(1), type: "PAYMENT_ACCOUNTS", accounts: [] }, ["accounts"]],
    [
      "PAYMENT_ACCOUNTS nomor berisi huruf",
      { id: id(1), type: "PAYMENT_ACCOUNTS", accounts: [{ bank: "B", number: "12ab34", holder: "PT" }] },
      ["accounts", 0, "number"],
    ],
    [
      "PAYMENT_ACCOUNTS nomor diakhiri strip",
      { id: id(1), type: "PAYMENT_ACCOUNTS", accounts: [{ bank: "B", number: "1234-", holder: "PT" }] },
      ["accounts", 0, "number"],
    ],
    [
      "PAYMENT_ACCOUNTS nomor dobel (beda pemisah)",
      {
        id: id(1),
        type: "PAYMENT_ACCOUNTS",
        accounts: [
          { bank: "A", number: "123 456", holder: "PT" },
          { bank: "B", number: "123-456", holder: "PT" },
        ],
      },
      ["accounts"],
    ],
    [
      "PAYMENT_ACCOUNTS tanpa atas nama",
      { id: id(1), type: "PAYMENT_ACCOUNTS", accounts: [{ bank: "B", number: "123" }] },
      ["accounts", 0, "holder"],
    ],
    [
      "PAYMENT_ACCOUNTS tombol javascript:",
      {
        id: id(1),
        type: "PAYMENT_ACCOUNTS",
        accounts: [{ bank: "B", number: "123", holder: "PT" }],
        confirm: { label: "Konfirmasi", href: "javascript:alert(1)" },
      },
      ["confirm", "href"],
    ],
  ] as const)("menolak %s", (_label, block, path) => {
    const result = pageBlockSchema.safeParse(block);
    expect(result.success).toBe(false);
    if (path.length > 0) expect(result.error?.issues.map((issue) => issue.path)).toContainEqual(path);
  });
});

it("pesan error media dalam Bahasa Indonesia", () => {
  const missing = pageBlockSchema.safeParse({ id: id(1), type: "IMAGE", image: null });
  expect(missing.error?.issues[0]?.message).toBe("Pilih gambar.");
  const broken = pageBlockSchema.safeParse({ id: id(1), type: "DOWNLOAD", label: "Unduh", file: "x.pdf" });
  expect(broken.error?.issues[0]?.message).toBe("Media tidak valid.");
});

describe("pageBlocksSchema", () => {
  it("menolak id blok dobel", () => {
    const block = { id: id(1), type: "LIST", items: ["a"] };
    expect(pageBlocksSchema.safeParse([block, block]).success).toBe(false);
  });

  it(`maksimal ${PAGE_BLOCKS_MAX} blok`, () => {
    const blocks = Array.from({ length: PAGE_BLOCKS_MAX + 1 }, (_, index) => ({
      id: id(index + 1),
      type: "LIST",
      items: ["a"],
    }));
    expect(pageBlocksSchema.safeParse(blocks).success).toBe(false);
    expect(pageBlocksSchema.safeParse(blocks.slice(0, PAGE_BLOCKS_MAX)).success).toBe(true);
  });
});

describe("parseStoredBlocks", () => {
  it("blok rusak dilewati satu per satu, sisanya tetap tampil", () => {
    const stored = [
      { id: id(1), type: "LIST", items: ["a"] },
      { id: id(2), type: "LIST", items: [] },
      { id: id(3), type: "UNKNOWN" },
      { id: id(4), type: "IMAGE", image: { mediaId: MEDIA_IMAGE } },
    ];
    expect(parseStoredBlocks(stored).map((block) => block.id)).toEqual([id(1), id(4)]);
  });

  it("bukan array: kosong", () => {
    expect(parseStoredBlocks({ blocks: [] })).toEqual([]);
    expect(parseStoredBlocks(null)).toEqual([]);
  });
});

describe("pageBlockMediaRefs", () => {
  it("sama dengan pencarian generik key mediaId", () => {
    const blocks = pageBlocksSchema.parse(fullBlocks());
    const typed = pageBlockMediaRefs(blocks).map(({ path, mediaId }) => ({ path, mediaId }));
    expect(typed).toEqual(collectMediaRefs(blocks));
  });

  it("IMAGE = gambar wajib alt, DOWNLOAD = PDF, DOWNLOAD tanpa file dilewati", () => {
    const blocks = pageBlocksSchema.parse([
      { id: id(1), type: "IMAGE", image: { mediaId: MEDIA_IMAGE } },
      { id: id(2), type: "DOWNLOAD", label: "Unduh", file: null },
      { id: id(3), type: "DOWNLOAD", label: "Unduh", file: { mediaId: MEDIA_PDF } },
    ]);
    expect(pageBlockMediaRefs(blocks)).toEqual([
      { path: "0.image", mediaId: MEDIA_IMAGE, kind: "image", requireAlt: true },
      { path: "2.file", mediaId: MEDIA_PDF, kind: "pdf", requireAlt: false },
    ]);
  });

  it("PAYMENT_ACCOUNTS: logo bank = gambar dekoratif (alt tidak wajib), rekening tanpa logo dilewati", () => {
    const blocks = pageBlocksSchema.parse([
      {
        id: id(1),
        type: "PAYMENT_ACCOUNTS",
        accounts: [
          { bank: "A", number: "1", holder: "PT" },
          { bank: "B", number: "2", holder: "PT", logo: { mediaId: MEDIA_IMAGE } },
        ],
      },
    ]);
    expect(pageBlockMediaRefs(blocks)).toEqual([
      { path: "0.accounts.1.logo", mediaId: MEDIA_IMAGE, kind: "image", requireAlt: false },
    ]);
  });
});
