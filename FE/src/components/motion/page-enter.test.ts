import { describe, expect, it } from "vitest";
import { isClientLinkClick, LINK_INTENT_MS, pageEnterFrom, pageEnterStepMs, shouldAnimateEnter } from "./page-enter-plan";
import { PAGE_ENTER_MS, PAGE_ENTER_TOTAL_MS } from "./tokens";

const base = { firstRender: false, pathnameChanged: true, sinceLinkClick: 120, reducedMotion: false };

describe("shouldAnimateEnter", () => {
  it("klik link ke pathname baru: beranimasi", () => {
    expect(shouldAnimateEnter(base)).toBe(true);
  });

  it("muat penuh / reload: tidak (LCP & DESIGN 8.3)", () => {
    expect(shouldAnimateEnter({ ...base, firstRender: true })).toBe(false);
  });

  it("Back/Forward (tanpa klik link) atau klik yang sudah lama: tidak", () => {
    expect(shouldAnimateEnter({ ...base, sinceLinkClick: null })).toBe(false);
    expect(shouldAnimateEnter({ ...base, sinceLinkClick: LINK_INTENT_MS + 1 })).toBe(false);
  });

  it("hanya query berubah (filter katalog) atau reduced motion: tidak", () => {
    expect(shouldAnimateEnter({ ...base, pathnameChanged: false })).toBe(false);
    expect(shouldAnimateEnter({ ...base, reducedMotion: true })).toBe(false);
  });
});

describe("isClientLinkClick", () => {
  const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
  const link = { href: "http://localhost:3000/jadwal", target: "", hasDownload: false };
  const origin = "http://localhost:3000";

  it("klik biasa ke link internal", () => {
    expect(isClientLinkClick(event, link, origin)).toBe(true);
  });

  it("tab baru, modifier, tombol tengah, unduhan, link luar: bukan navigasi klien", () => {
    expect(isClientLinkClick({ ...event, ctrlKey: true }, link, origin)).toBe(false);
    expect(isClientLinkClick({ ...event, button: 1 }, link, origin)).toBe(false);
    expect(isClientLinkClick(event, { ...link, target: "_blank" }, origin)).toBe(false);
    expect(isClientLinkClick(event, { ...link, hasDownload: true }, origin)).toBe(false);
    expect(isClientLinkClick(event, { ...link, href: "https://wa.me/62" }, origin)).toBe(false);
  });
});

describe("pageEnterStepMs", () => {
  it("elemen terakhir selesai <= 500 ms berapa pun jumlahnya", () => {
    for (const count of [1, 2, 3, 4, 8]) {
      expect((count - 1) * pageEnterStepMs(count) + PAGE_ENTER_MS).toBeLessThanOrEqual(PAGE_ENTER_TOTAL_MS);
    }
    expect(pageEnterStepMs(3)).toBe(60);
    expect(pageEnterStepMs(1)).toBe(0);
  });
});

describe("pageEnterFrom", () => {
  it("hanya opacity, transform, clip-path; h1 wipe tanpa opacity 0", () => {
    for (const tag of ["H1", "P", "NAV"]) {
      expect(Object.keys(pageEnterFrom(tag)).every((key) => ["opacity", "transform", "clipPath"].includes(key))).toBe(true);
    }
    expect(pageEnterFrom("H1").opacity).toBeUndefined();
    expect(pageEnterFrom("H1").clipPath).toBe("inset(0% 0% 100% 0%)");
  });
});
