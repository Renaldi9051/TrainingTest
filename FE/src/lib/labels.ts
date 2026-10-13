import type {
  InquirySource,
  InquiryStatus,
  ScheduleStatus,
  TrainingMethod,
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
