"use client";

import { useEffect } from "react";
import { setContactContext } from "@/lib/contact-context";
import type { ContactTopic } from "@/lib/whatsapp";

// Dipasang halaman detail pelatihan/layanan: pesan WA di panel floating contact memuat judulnya, dan
// `bar` menandai bar CTA mobile yang membuka panel (tombol bulat disembunyikan di mobile).
export function ContactContext({ topic, bar = false }: { topic: ContactTopic; bar?: boolean }) {
  const { kind, title } = topic;
  useEffect(() => setContactContext({ topic: { kind, title }, bar }), [kind, title, bar]);
  return null;
}
