import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("ukuran font kustom tidak menghapus warna teks", () => {
    expect(cn("text-inverse-fg text-small")).toBe("text-inverse-fg text-small");
    expect(cn("text-fg-strong", "text-body-lg")).toBe("text-fg-strong text-body-lg");
    expect(cn("text-label text-fg-muted")).toBe("text-label text-fg-muted");
  });

  it("ukuran font kustom saling menggantikan, warna juga", () => {
    expect(cn("text-small", "text-body")).toBe("text-body");
    expect(cn("text-fg", "text-fg-muted")).toBe("text-fg-muted");
  });
});
