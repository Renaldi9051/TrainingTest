import { describe, expect, it } from "vitest";
import { pageMetadata } from "./page-metadata";

const emptySeo = { title: "", description: "", ogImage: null };

describe("pageMetadata", () => {
  it("tanpa deskripsi SEO maupun cadangan: key description tidak ada supaya default situs dipakai", () => {
    const metadata = pageMetadata({ title: "Profil", path: "/profil", seo: emptySeo });
    expect(metadata).not.toHaveProperty("description");
    expect(metadata.openGraph).not.toHaveProperty("description");
    expect(metadata.title).toBe("Profil");
  });

  it("deskripsi SEO diutamakan, lalu deskripsi cadangan", () => {
    expect(pageMetadata({ title: "A", path: "/a", seo: { ...emptySeo, description: "Dari SEO" }, fallbackDescription: "Cadangan" }).description).toBe("Dari SEO");
    const fallback = pageMetadata({ title: "A", path: "/a", seo: emptySeo, fallbackDescription: "Cadangan" });
    expect(fallback.description).toBe("Cadangan");
    expect(fallback.openGraph).toHaveProperty("description", "Cadangan");
  });
});
