import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidate = vi.hoisted(() => vi.fn<(tags: string[]) => Promise<boolean>>(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { revalidateEntity, SLUG_CHANGE_FOLLOW_UP_MS, tagsForEvent, withRevalidateBatch } from "@/lib/revalidate-map";

beforeEach(() => {
  revalidate.mockReset();
  revalidate.mockResolvedValue(true);
});

// Tag yang dipanggil service Fase 2 sebelum peta ini ada. Pemindahan ke peta tidak boleh
// menghilangkan satu pun (Fase 3 hanya menambah `home`).
describe("tagsForEvent: tag Fase 2 tetap terpanggil", () => {
  it.each([
    [{ entity: "Settings" } as const, ["settings"]],
    [{ entity: "Nav" } as const, ["nav"]],
    [{ entity: "Media" } as const, ["media"]],
    [{ entity: "CategoryOrder" } as const, ["categories"]],
    [{ entity: "DayChange" } as const, ["schedules", "trainings"]],
    [
      { entity: "Category", slugs: ["baru", "lama"] } as const,
      ["categories", "trainings", "category:baru", "category:lama"],
    ],
    [
      { entity: "Training", slugs: ["baru", null, "lama"] } as const,
      ["trainings", "categories", "schedules", "training:baru", "training:lama"],
    ],
    [{ entity: "Schedule", trainingSlugs: ["a", "a", undefined] } as const, ["schedules", "training:a"]],
  ])("%o", (event, phase2Tags) => {
    const result = tagsForEvent(event);
    expect(result).toEqual(expect.arrayContaining(phase2Tags));
    expect(new Set(result).size).toBe(result.length);
  });
});

it("urutan kategori me-revalidate pelatihan (gambar kategori pengganti sampul ikut urutan)", () => {
  expect(tagsForEvent({ entity: "CategoryOrder" })).toEqual(expect.arrayContaining(["categories", "home", "trainings"]));
});

describe("tagsForEvent: beranda ikut di-revalidate saat datanya berubah", () => {
  it.each([
    { entity: "Training", slugs: ["a"] } as const,
    { entity: "Schedule", trainingSlugs: ["a"] } as const,
    { entity: "Category", slugs: ["a"] } as const,
    { entity: "CategoryOrder" } as const,
    { entity: "Service", slugs: ["a"] } as const,
    { entity: "Client" } as const,
    { entity: "Testimonial" } as const,
    { entity: "HomeSection" } as const,
    { entity: "DayChange" } as const,
  ])("%o", (event) => {
    expect(tagsForEvent(event)).toContain("home");
  });

  it.each([
    { entity: "Settings" } as const,
    { entity: "Nav" } as const,
    { entity: "Media" } as const,
    { entity: "PortfolioItem" } as const,
    { entity: "MarketingContact" } as const,
    { entity: "MediaPartner" } as const,
    { entity: "Page", slugs: ["a"] } as const,
  ])("%o tidak menyentuh beranda", (event) => {
    expect(tagsForEvent(event)).not.toContain("home");
  });
});

describe("tagsForEvent: entitas Fase 3", () => {
  it.each([
    [{ entity: "Page", slugs: ["baru", "lama"] } as const, ["pages", "page:baru", "page:lama"]],
    [
      { entity: "Service", slugs: ["baru", "lama"] } as const,
      ["services", "home", "pages", "service:baru", "service:lama"],
    ],
    [{ entity: "Client" } as const, ["clients", "home"]],
    [{ entity: "Testimonial" } as const, ["testimonials", "home"]],
    [{ entity: "PortfolioItem" } as const, ["portfolio"]],
    [{ entity: "MarketingContact" } as const, ["marketing"]],
    [{ entity: "MediaPartner" } as const, ["media-partners"]],
    [{ entity: "HomeSection" } as const, ["home"]],
  ])("%o", (event, expected) => {
    expect(tagsForEvent(event)).toEqual(expected);
  });
});

describe("revalidateEntity", () => {
  it("di luar batch: langsung dikirim, beberapa event digabung tanpa dobel", async () => {
    await revalidateEntity([
      { entity: "Training", slugs: ["a"] },
      { entity: "Schedule", trainingSlugs: ["a"] },
    ]);
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(revalidate).toHaveBeenCalledWith(["trainings", "categories", "schedules", "home", "training:a"]);
  });

  it("meneruskan hasil gagal dari FE (dipakai scheduler untuk mencoba lagi)", async () => {
    revalidate.mockResolvedValue(false);
    expect(await revalidateEntity({ entity: "DayChange" })).toBe(false);
  });

  it("slug kosong saja tidak menambah tag slug", async () => {
    await revalidateEntity({ entity: "Category", slugs: [] });
    expect(revalidate).toHaveBeenCalledWith(["categories", "trainings", "home"]);
  });
});

describe("withRevalidateBatch", () => {
  it("mengumpulkan tag dan mengirim sekali di akhir", async () => {
    const result = await withRevalidateBatch(async () => {
      await revalidateEntity({ entity: "Nav" });
      await revalidateEntity({ entity: "Nav" });
      await revalidateEntity({ entity: "Media" });
      expect(revalidate).not.toHaveBeenCalled();
      return "selesai";
    });
    expect(result).toBe("selesai");
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(revalidate).toHaveBeenCalledWith(["nav", "media"]);
  });

  it("tanpa mutasi: tidak memanggil FE", async () => {
    await withRevalidateBatch(async () => null);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("tetap mengirim tag yang sudah terkumpul walau fn melempar error", async () => {
    await expect(
      withRevalidateBatch(async () => {
        await revalidateEntity({ entity: "Settings" });
        throw new Error("gagal setelah commit");
      }),
    ).rejects.toThrow("gagal setelah commit");
    expect(revalidate).toHaveBeenCalledWith(["settings"]);
  });

  it("batch bersarang memakai antrean terluar", async () => {
    await withRevalidateBatch(async () => {
      await withRevalidateBatch(async () => {
        await revalidateEntity({ entity: "Nav" });
      });
      expect(revalidate).not.toHaveBeenCalled();
      await revalidateEntity({ entity: "Settings" });
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(revalidate).toHaveBeenCalledWith(["nav", "settings"]);
  });

  it("request paralel tidak saling mencampur antrean", async () => {
    await Promise.all([
      withRevalidateBatch(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        await revalidateEntity({ entity: "Nav" });
      }),
      withRevalidateBatch(async () => {
        await revalidateEntity({ entity: "Media" });
      }),
    ]);
    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(revalidate.mock.calls.map(([tags]) => tags)).toEqual(expect.arrayContaining([["nav"], ["media"]]));
  });
});

// Ganti slug: render yang sudah berjalan saat mutasi bisa tersimpan sebagai cache segar setelah
// revalidate pertama; tag event itu dikirim sekali lagi setelah jeda.
describe("revalidate susulan saat slug berubah", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("slug lama + baru: dikirim langsung, lalu sekali lagi setelah jeda", async () => {
    await revalidateEntity({ entity: "Service", slugs: ["baru", "lama"] });
    const expected = ["services", "home", "pages", "service:baru", "service:lama"];
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(revalidate).toHaveBeenLastCalledWith(expected);
    await vi.advanceTimersByTimeAsync(SLUG_CHANGE_FOLLOW_UP_MS - 1);
    expect(revalidate).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(revalidate).toHaveBeenLastCalledWith(expected);
  });

  it("slug tidak berubah (satu slug, atau slug lama = baru): tanpa susulan", async () => {
    await revalidateEntity({ entity: "Training", slugs: ["a", null] });
    await revalidateEntity({ entity: "Page", slugs: ["b", "b"] });
    await revalidateEntity({ entity: "Nav" });
    await vi.advanceTimersByTimeAsync(SLUG_CHANGE_FOLLOW_UP_MS * 2);
    expect(revalidate).toHaveBeenCalledTimes(3);
  });

  it("di dalam batch: susulan hanya untuk event yang mengganti slug, sekali setelah batch", async () => {
    await withRevalidateBatch(async () => {
      await revalidateEntity({ entity: "Category", slugs: ["kategori-baru", "kategori-lama"] });
      await revalidateEntity({ entity: "Nav" });
    });
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(revalidate).toHaveBeenLastCalledWith(["categories", "trainings", "home", "category:kategori-baru", "category:kategori-lama", "nav"]);
    await vi.advanceTimersByTimeAsync(SLUG_CHANGE_FOLLOW_UP_MS);
    expect(revalidate).toHaveBeenCalledTimes(2);
    expect(revalidate).toHaveBeenLastCalledWith(["categories", "trainings", "home", "category:kategori-baru", "category:kategori-lama"]);
  });
});
