import { describe, expect, it } from "vitest";
import { z } from "zod";
import { csvParam, listMeta, listQuerySchema, pagination, parseSearchParams } from "@/lib/list-query";

const schema = listQuerySchema({
  sortFields: ["title", "updatedAt"] as const,
  defaultSort: "-updatedAt",
  extra: { status: z.enum(["DRAFT", "PUBLISHED"]).optional(), category: csvParam() },
});

const parse = (query: string) => parseSearchParams(schema, new URLSearchParams(query));

describe("listQuerySchema", () => {
  it("memakai default: halaman 1, 20 per halaman, sort default", () => {
    expect(parse("")).toEqual({
      page: 1,
      pageSize: 20,
      q: undefined,
      sort: { field: "updatedAt", direction: "desc" },
      status: undefined,
      category: [],
    });
  });

  it("membaca page, pageSize, q (di-trim), sort naik dan filter modul", () => {
    const result = parse("page=3&pageSize=50&q=%20kpi%20&sort=title&status=DRAFT&category=a,b,a");
    expect(result).toMatchObject({
      page: 3,
      pageSize: 50,
      q: "kpi",
      sort: { field: "title", direction: "asc" },
      status: "DRAFT",
      category: ["a", "b"],
    });
  });

  it("q kosong jadi undefined", () => {
    expect(parse("q=%20%20").q).toBeUndefined();
  });

  it("menolak pageSize di atas 100 dan page < 1", () => {
    expect(() => parse("pageSize=101")).toThrow();
    expect(() => parse("page=0")).toThrow();
  });

  it("menolak sort di luar whitelist", () => {
    expect(() => parse("sort=passwordHash")).toThrow(/Urutan tidak dikenal/);
  });

  it("menolak status yang tidak dikenal", () => {
    expect(() => parse("status=ARCHIVED")).toThrow();
  });
});

describe("pagination & listMeta", () => {
  it("menghitung skip/take dan totalPages", () => {
    expect(pagination(3, 20)).toEqual({ skip: 40, take: 20 });
    expect(listMeta(1, 20, 41)).toEqual({ page: 1, pageSize: 20, total: 41, totalPages: 3 });
    expect(listMeta(1, 20, 0).totalPages).toBe(1);
  });
});
