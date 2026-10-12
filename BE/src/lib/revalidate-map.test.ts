import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidate = vi.hoisted(() => vi.fn<(tags: string[]) => Promise<boolean>>(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import { revalidateEntity, tagsForEvent, withRevalidateBatch } from "@/lib/revalidate-map";

beforeEach(() => {
  revalidate.mockReset();
  revalidate.mockResolvedValue(true);
});

// Tag yang dipanggil service Fase 2 sebelum peta ini ada. Pemindahan ke peta tidak boleh
// menghilangkan satu pun.
describe("tagsForEvent: tag Fase 2 tetap sama", () => {
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
    [
      { entity: "Schedule", trainingSlugs: ["a", "a", undefined] } as const,
      ["schedules", "training:a"],
    ],
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
    expect(revalidate).toHaveBeenCalledWith(["trainings", "categories", "schedules", "training:a"]);
  });

  it("meneruskan hasil gagal dari FE (dipakai scheduler untuk mencoba lagi)", async () => {
    revalidate.mockResolvedValue(false);
    expect(await revalidateEntity({ entity: "DayChange" })).toBe(false);
  });

  it("slug kosong saja tidak menambah tag slug", async () => {
    await revalidateEntity({ entity: "Category", slugs: [] });
    expect(revalidate).toHaveBeenCalledWith(["categories", "trainings"]);
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
