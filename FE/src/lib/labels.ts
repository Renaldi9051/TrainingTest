import type {
  InquirySource,
  InquiryStatus,
  PortfolioActivityType,
  ScheduleStatus,
  TrainingMethod,
  TrainingLevel,
  TrainingPublicState,
  TrainingType,
} from "@/lib/api/types";

// Label UI untuk enum dari BE.
export const METHOD_LABELS: Record<TrainingMethod, string> = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  HYBRID: "Hybrid",
};

export const TYPE_LABELS: Record<TrainingType, string> = {
  PUBLIC: "Public",
  IN_HOUSE: "In-house",
};

export const LEVEL_LABELS: Record<TrainingLevel, string> = {
  BEGINNER: "Dasar",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

// Label chip filter /profil/portofolio (?jenis=<param>).
export const ACTIVITY_TYPE_LABELS: Record<PortfolioActivityType, string> = {
  FIELD: "Lapangan",
  CLASSROOM: "Kelas",
  CERTIFICATION: "Sertifikasi",
  OUTBOUND: "Outbound",
};

export const ACTIVITY_TYPE_PARAMS: Record<PortfolioActivityType, string> = {
  FIELD: "lapangan",
  CLASSROOM: "kelas",
  CERTIFICATION: "sertifikasi",
  OUTBOUND: "outbound",
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  OPEN: "Dibuka",
  FULL: "Penuh",
  COMPLETED: "Selesai",
};

export const PUBLIC_STATE_LABELS: Record<TrainingPublicState, string> = {
  DRAFT: "Draf",
  SCHEDULED: "Terjadwal",
  PUBLISHED: "Tayang",
};


export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: "Baru",
  IN_PROGRESS: "Diproses",
  DONE: "Selesai",
};

export const INQUIRY_SOURCE_LABELS: Record<InquirySource, string> = {
  TRAINING_DETAIL: "Detail pelatihan",
  CONTACT: "Halaman kontak",
};
