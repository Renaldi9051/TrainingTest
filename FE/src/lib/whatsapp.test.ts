import { describe, expect, it } from "vitest";
import { marketingMessage, whatsappLink, whatsappServiceUrl, whatsappTrainingUrl } from "@/lib/whatsapp";

const text = (url: string) => new URL(url).searchParams.get("text");

describe("whatsappTrainingUrl / whatsappServiceUrl", () => {
  it("pesan otomatis berisi judul pelatihan", () => {
    const url = new URL(whatsappTrainingUrl("6281200000000", "KPI & OKR"));
    expect(url.origin + url.pathname).toBe("https://wa.me/6281200000000");
    expect(url.searchParams.get("text")).toBe('Halo, saya tertarik dengan pelatihan "KPI & OKR". Mohon info jadwal dan investasinya.');
  });

  it("layanan: judul layanan", () => {
    expect(text(whatsappServiceUrl("6281200000000", "Konsultasi SDM"))).toBe('Halo, saya ingin konsultasi tentang layanan "Konsultasi SDM".');
  });
});

describe("whatsappLink", () => {
  it("tanpa pesan: tanpa ?text", () => {
    expect(whatsappLink("6281200000000", null)).toBe("https://wa.me/6281200000000");
    expect(whatsappLink("6281200000000", "")).toBe("https://wa.me/6281200000000");
  });

  it("pesan di-encode (spasi, kutip, &, #)", () => {
    const url = whatsappLink("6281200000000", 'A & B "#1"');
    expect(url).not.toContain(" ");
    expect(text(url)).toBe('A & B "#1"');
  });
});

describe("marketingMessage (floating contact)", () => {
  const sari = { name: "Sari", defaultMessage: "Halo Sari, saya mau tanya in-house." };

  it("detail pelatihan: menyapa marketing dan memuat judul pelatihan", () => {
    expect(marketingMessage(sari, { kind: "training", title: "Pilot Drone Dasar" })).toBe(
      'Halo Sari, saya tertarik dengan pelatihan "Pilot Drone Dasar". Mohon info jadwal dan investasinya.',
    );
  });

  it("detail layanan: memuat judul layanan", () => {
    expect(marketingMessage(sari, { kind: "service", title: "Audit K3" })).toBe('Halo Sari, saya ingin konsultasi tentang layanan "Audit K3".');
  });

  it("halaman lain: pesan default dari admin, lalu sapaan umum kalau kosong", () => {
    expect(marketingMessage(sari, null)).toBe(sari.defaultMessage);
    expect(marketingMessage({ name: "Budi", defaultMessage: null }, null)).toBe("Halo Budi, saya ingin bertanya.");
    expect(marketingMessage({ name: "Budi", defaultMessage: "   " }, null)).toBe("Halo Budi, saya ingin bertanya.");
  });
});
