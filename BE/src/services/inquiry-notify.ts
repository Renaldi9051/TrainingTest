import type { InquiryDto } from "@/services/inquiry";

// Notifikasi inquiry baru ke admin. Saat ini opsi A (keputusan 4.2): tanpa notifikasi eksternal;
// admin melihat badge sidebar dan kartu dashboard. Interface ini titik sambung untuk opsi B (SMTP):
// tambah SmtpInquiryNotifier (nodemailer, env SMTP_* + INQUIRY_NOTIFY_TO divalidasi di env.ts) dan
// pilih di getInquiryNotifier() kalau env-nya diisi. Pemanggil tidak berubah.
export interface InquiryNotifier {
  notify(inquiry: InquiryDto): Promise<void>;
}

export const noopInquiryNotifier: InquiryNotifier = {
  async notify() {},
};

export function getInquiryNotifier(): InquiryNotifier {
  return noopInquiryNotifier;
}
