// Pembagian foto galeri kategori: tiap media hanya boleh dipakai SATU kategori.
// Dipakai scripts/backfill-category-gallery.ts. Fungsi murni (tanpa DB) supaya bisa dites.
//
// Algoritma: bipartite matching berkapasitas (augmenting path ala Kuhn). Hasilnya jumlah slot
// terisi yang maksimum (sama dengan max-flow), jadi tidak ada cara memilih lain yang mengisi
// lebih banyak slot dengan foto unik. Slot diisi bergiliran (ronde 1 untuk semua kategori, lalu
// ronde 2, ...) dan augmenting path tidak pernah mengurangi jumlah foto kategori yang sudah
// terisi, jadi kategori dengan kandidat sedikit tidak dikorbankan demi kategori yang sudah penuh.

export type GalleryCandidate = { mediaId: string; label: string };

export type GalleryCategoryInput = {
  id: string;
  // Urut preferensi (paling cocok dulu). Duplikat mediaId diabaikan.
  candidates: GalleryCandidate[];
};

export function allocateUniqueGallery(
  categories: GalleryCategoryInput[],
  max: number,
  // Media yang sudah terpakai di luar rencana ini (mis. galeri kategori yang sudah terisi).
  taken: ReadonlySet<string> = new Set(),
): Map<string, GalleryCandidate[]> {
  const candidates = categories.map((category) => {
    const seen = new Set<string>();
    return category.candidates.filter((candidate) => {
      if (taken.has(candidate.mediaId) || seen.has(candidate.mediaId)) return false;
      seen.add(candidate.mediaId);
      return true;
    });
  });
  const assigned = categories.map(() => new Set<string>());
  const owner = new Map<string, number>();

  // Cari foto baru untuk kategori `index`; boleh merebut foto kategori lain asalkan kategori itu
  // bisa menggantinya dengan foto lain (rekursif). Mengembalikan true kalau satu slot bertambah.
  function augment(index: number, visited: Set<string>): boolean {
    for (const { mediaId } of candidates[index]) {
      if (visited.has(mediaId) || assigned[index].has(mediaId)) continue;
      visited.add(mediaId);
      const current = owner.get(mediaId);
      if (current === undefined || augment(current, visited)) {
        if (current !== undefined) assigned[current].delete(mediaId);
        owner.set(mediaId, index);
        assigned[index].add(mediaId);
        return true;
      }
    }
    return false;
  }

  // Kategori dengan kandidat paling sedikit dulu di tiap ronde.
  const order = categories.map((_, index) => index).sort((a, b) => candidates[a].length - candidates[b].length);
  for (let round = 0; round < max; round += 1) {
    for (const index of order) {
      if (assigned[index].size === round) augment(index, new Set());
    }
  }

  const result = new Map<string, GalleryCandidate[]>();
  categories.forEach((category, index) => {
    // Urutan tampil mengikuti urutan preferensi kandidat, bukan urutan saat dipilih.
    result.set(
      category.id,
      candidates[index].filter((candidate) => assigned[index].has(candidate.mediaId)),
    );
  });
  return result;
}
