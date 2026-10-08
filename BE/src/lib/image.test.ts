import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processRasterImage } from "@/lib/image";

async function makeImage(width: number, height: number, format: "png" | "jpeg") {
  const image = sharp({ create: { width, height, channels: 3, background: "#7f7f7f" } });
  return new Uint8Array(await (format === "png" ? image.png() : image.jpeg()).toBuffer());
}

describe("processRasterImage", () => {
  it("JPG besar: WebP ukuran asli + varian 320/768/1600", async () => {
    const result = await processRasterImage(await makeImage(2000, 1000, "jpeg"));
    expect(result.main).toMatchObject({ width: 2000, height: 1000 });
    expect((await sharp(result.main.data).metadata()).format).toBe("webp");
    expect(result.variants[320]).toMatchObject({ width: 320, height: 160 });
    expect(result.variants[768]).toMatchObject({ width: 768, height: 384 });
    expect(result.variants[1600]).toMatchObject({ width: 1600, height: 800 });
    for (const variant of Object.values(result.variants)) {
      expect((await sharp(variant.data).metadata()).format).toBe("webp");
    }
  });

  it("PNG kecil: varian tidak di-upscale", async () => {
    const result = await processRasterImage(await makeImage(500, 250, "png"));
    expect(result.variants[320]).toMatchObject({ width: 320, height: 160 });
    expect(result.variants[768]).toMatchObject({ width: 500, height: 250 });
    expect(result.variants[1600]).toMatchObject({ width: 500, height: 250 });
  });

  it("menolak data yang bukan gambar", async () => {
    await expect(processRasterImage(new TextEncoder().encode("bukan gambar"))).rejects.toThrow();
  });
});
