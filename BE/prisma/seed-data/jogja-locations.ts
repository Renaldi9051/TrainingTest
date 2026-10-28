// Lokasi jadwal offline/hybrid (pemilik, 28 Okt 2026): hanya area DIY, tidak ke kota lain.
// [kota, tempat]. Tempat tetap generik (bukan nama hotel/gedung nyata).
export const JOGJA_LOCATIONS: readonly (readonly [string, string])[] = [
  ["Yogyakarta", "Hotel mitra, Yogyakarta"],
  ["Sleman", "Ruang pelatihan, Sleman"],
  ["Bantul", "Hotel mitra, Bantul"],
  ["Kulon Progo", "Ruang pelatihan, Kulon Progo"],
];

export const JOGJA_CITIES: readonly string[] = JOGJA_LOCATIONS.map(([city]) => city);
