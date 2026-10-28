// Lokasi jadwal offline/hybrid (pemilik, 28 Okt 2026): hanya area DIY, di hotel/gedung yang benar-benar ada.
// [kota, tempat]; tabel jadwal publik menampilkan "kota · tempat", jadi tempat cukup nama gedungnya.
// Kota & tempat Jogja diberikan bergiliran, jadi urutan ini menentukan sebaran per area.
export const JOGJA_LOCATIONS: readonly (readonly [string, string])[] = [
  ["Yogyakarta", "Hotel Tentrem Yogyakarta"],
  ["Sleman", "Hyatt Regency Yogyakarta"],
  ["Bantul", "Grand Rohan Jogja"],
  ["Kulon Progo", "Novotel Yogyakarta International Airport"],
  ["Yogyakarta", "Grand Inna Malioboro"],
  ["Sleman", "Royal Ambarrukmo Yogyakarta"],
  ["Bantul", "Jogja Expo Center"],
  ["Kulon Progo", "ibis Yogyakarta International Airport"],
  ["Yogyakarta", "The Phoenix Hotel Yogyakarta"],
  ["Sleman", "Sheraton Mustika Yogyakarta"],
];

export const JOGJA_CITIES: readonly string[] = [...new Set(JOGJA_LOCATIONS.map(([city]) => city))];

// Tempat generik dari seed sebelumnya ("Hotel mitra, ..."/"Ruang pelatihan"), diganti tempat nyata di atas.
export const GENERIC_VENUES: readonly string[] = [
  "Hotel mitra, Yogyakarta",
  "Ruang pelatihan, Sleman",
  "Hotel mitra, Bantul",
  "Ruang pelatihan, Kulon Progo",
  "Ruang pelatihan",
];
