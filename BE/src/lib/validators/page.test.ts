import { describe, expect, it } from "vitest";
import {
  PAGE_SLUG_RESERVED_MESSAGE,
  pageCreateSchema,
  pageSlugIssue,
  pageUpdateSchema,
  PROFILE_SLUG,
  PROFILE_SLUG_LOCKED_MESSAGE,
  RESERVED_PAGE_SLUGS,
} from "@/lib/validators/page";

describe("pageSlugIssue", () => {
  it.each(["profil", "layanan", "pelatihan", "jadwal", "kontak", "admin", "api", "uploads", "sitemap", "icon"])(
    "halaman STANDARD tidak boleh memakai slug route %s",
    (slug) => {
      expect(pageSlugIssue(slug, "STANDARD")).toBe(PAGE_SLUG_RESERVED_MESSAGE);
    },
  );

  it("halaman STANDARD boleh memakai slug lain", () => {
    expect(pageSlugIssue("syarat-dan-ketentuan", "STANDARD")).toBeNull();
    // Hanya cocok persis, bukan awalan.
    expect(pageSlugIssue("profil-perusahaan", "STANDARD")).toBeNull();
  });

  it("halaman PROFILE: slug profil dikecualikan dari daftar reserved", () => {
    expect(RESERVED_PAGE_SLUGS.has(PROFILE_SLUG)).toBe(true);
    expect(pageSlugIssue(PROFILE_SLUG, "PROFILE")).toBeNull();
  });

  it("halaman PROFILE: slug lain ditolak (bukan diabaikan)", () => {
    expect(pageSlugIssue("tentang-kami", "PROFILE")).toBe(PROFILE_SLUG_LOCKED_MESSAGE);
    expect(pageSlugIssue("layanan", "PROFILE")).toBe(PROFILE_SLUG_LOCKED_MESSAGE);
  });
});

describe("pageCreateSchema", () => {
  it("default: draft, tanpa blok, SEO kosong", () => {
    expect(pageCreateSchema.parse({ title: "Kebijakan privasi" })).toEqual({
      title: "Kebijakan privasi",
      slug: undefined,
      blocks: [],
      status: "DRAFT",
      seo: { title: "", description: "", ogImageId: null },
    });
  });

  it("tidak menerima kind (halaman PROFILE hanya dibuat seed)", () => {
    expect(pageCreateSchema.parse({ title: "x", kind: "PROFILE" })).not.toHaveProperty("kind");
  });

  it("blok divalidasi", () => {
    const result = pageCreateSchema.safeParse({ title: "x", blocks: [{ id: "x", type: "LIST" }] });
    expect(result.success).toBe(false);
  });
});

describe("pageUpdateSchema", () => {
  it("minimal satu perubahan", () => {
    expect(pageUpdateSchema.safeParse({}).success).toBe(false);
    expect(pageUpdateSchema.parse({ status: "PUBLISHED" })).toMatchObject({ status: "PUBLISHED" });
  });
});
