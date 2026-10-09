// Status jadwal yang ditampilkan ke publik. Sesi yang tanggal selesainya sudah lewat (WIB) selalu
// SELESAI, walaupun admin belum mengubah statusnya.
export type PublicScheduleStatus = "OPEN" | "FULL" | "COMPLETED";

export function scheduleDisplayStatus(
  schedule: { status: PublicScheduleStatus; endDate: Date },
  today: Date,
): PublicScheduleStatus {
  if (schedule.endDate.getTime() < today.getTime()) return "COMPLETED";
  return schedule.status;
}
