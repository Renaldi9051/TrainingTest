"use client";

import { useId } from "react";

// Id elemen form yang unik per instance komponen. Next (cacheComponents) menyimpan halaman
// sebelumnya dalam keadaan tersembunyi saat navigasi di klien, jadi form yang sama (mis. Tambah
// lalu Ubah) bisa ada dua kali di DOM. Id statis membuat label, aria-describedby, dan atribut
// form= menunjuk elemen yang salah.
export function useScopedId(prefix: string): (name?: string) => string {
  const uid = useId();
  return (name) => (name ? `${prefix}-${uid}-${name}` : `${prefix}-${uid}`);
}
