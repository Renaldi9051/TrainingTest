import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentContactTopic, setContactContext } from "@/lib/contact-context";

let dataset: Record<string, string>;

beforeEach(() => {
  dataset = {};
  vi.stubGlobal("document", { documentElement: { dataset } });
});
afterEach(() => vi.unstubAllGlobals());

describe("setContactContext", () => {
  it("memasang topik & penanda bar, lalu membersihkannya", () => {
    const cleanup = setContactContext({ topic: { kind: "training", title: "Pilot Drone" }, bar: true });
    expect(currentContactTopic()).toEqual({ kind: "training", title: "Pilot Drone" });
    expect(dataset.contactBar).toBe("on");
    cleanup();
    expect(currentContactTopic()).toBeNull();
    expect(dataset.contactBar).toBe("off");
  });

  it("pembersihan halaman lama tidak menghapus konteks halaman baru", () => {
    const oldPage = setContactContext({ topic: { kind: "training", title: "Lama" }, bar: true });
    setContactContext({ topic: { kind: "service", title: "Baru" }, bar: false });
    oldPage();
    expect(currentContactTopic()).toEqual({ kind: "service", title: "Baru" });
    expect(dataset.contactBar).toBe("off");
  });
});
