// Sesi yang bisa dipilih di form inquiry detail pelatihan. Inquiry tidak punya kolom sesi: pilihan
// ditulis di awal pesan supaya marketing tahu sesi yang dimaksud.
export type InquirySession = { id: string; label: string };

export function messageWithSession(message: string, session: InquirySession | undefined): string {
  if (!session) return message;
  const prefix = `Sesi: ${session.label}`;
  return message.trim() ? `${prefix}\n${message}` : prefix;
}
