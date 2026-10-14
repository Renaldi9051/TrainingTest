// Tautan & pesan otomatis WhatsApp (wa.me). Nomor sudah format wa.me dari BE (angka saja).
// Dipakai tombol WA di detail pelatihan/layanan dan panel floating contact (4.5).

// Topik halaman yang sedang dibuka: detail pelatihan atau layanan (lihat lib/contact-context.ts).
export type ContactTopic = { kind: "training" | "service"; title: string };

export function whatsappLink(number: string, message: string | null): string {
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${number}${text}`;
}

export function topicMessage(topic: ContactTopic, name?: string): string {
  const greeting = name ? `Halo ${name},` : "Halo,";
  return topic.kind === "training"
    ? `${greeting} saya tertarik dengan pelatihan "${topic.title}". Mohon info jadwal dan investasinya.`
    : `${greeting} saya ingin konsultasi tentang layanan "${topic.title}".`;
}

// Pesan ke satu marketing: topik halaman (detail) > pesan default kontak dari admin > sapaan umum.
export function marketingMessage(contact: { name: string; defaultMessage: string | null }, topic: ContactTopic | null): string {
  if (topic) return topicMessage(topic, contact.name);
  return contact.defaultMessage?.trim() || `Halo ${contact.name}, saya ingin bertanya.`;
}

// Tombol WhatsApp utama (nomor dari pengaturan situs) di detail pelatihan/layanan.
export function whatsappTrainingUrl(number: string, title: string): string {
  return whatsappLink(number, topicMessage({ kind: "training", title }));
}

export function whatsappServiceUrl(number: string, title: string): string {
  return whatsappLink(number, topicMessage({ kind: "service", title }));
}
