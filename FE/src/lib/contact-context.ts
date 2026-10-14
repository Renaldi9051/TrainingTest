import type { ContactTopic } from "@/lib/whatsapp";

// Konteks halaman untuk floating contact (hanya di browser): topik pesan WA dan ada tidaknya bar CTA
// mobile. Diisi lewat efek ContactContext di halaman detail, bukan dibaca dari DOM: setelah navigasi
// klien, halaman sebelumnya tetap ada di DOM dalam keadaan tersembunyi (React Activity), tetapi
// efeknya sudah dibersihkan.

type Context = { topic: ContactTopic; bar: boolean };

let current: Context | null = null;

// html[data-contact-bar]: "on" = bar CTA mobile tampil (tombol bulat disembunyikan di mobile),
// "off" = tidak ada bar yang tampil walau masih ada di DOM tersembunyi (lihat public.css).
export function setContactContext(context: Context): () => void {
  current = context;
  document.documentElement.dataset.contactBar = context.bar ? "on" : "off";
  return () => {
    // Halaman baru mungkin sudah memasang konteksnya sendiri.
    if (current !== context) return;
    current = null;
    document.documentElement.dataset.contactBar = "off";
  };
}

export function currentContactTopic(): ContactTopic | null {
  return current?.topic ?? null;
}
