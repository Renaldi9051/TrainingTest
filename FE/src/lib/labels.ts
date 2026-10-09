import type { ScheduleStatus, TrainingMethod, TrainingPublicState, TrainingType } from "@/lib/api/types";

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
