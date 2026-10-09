import { getDb } from "@/lib/db";
import { revalidateTags, RevalidateTag, tags } from "@/lib/revalidate";
import { appDateString } from "@/lib/time";

// Cache FE tidak tahu kapan `publishedAt` sebuah pelatihan tiba, dan tidak tahu kapan hari berganti
// (sesi yang lewat harus tampil SELESAI). Scheduler ini me-revalidate tag terkait:
// - setiap TICK_MS: pelatihan PUBLISHED yang waktu publish-nya sudah lewat tapi belum di-revalidate
//   (publishRevalidatedAt null atau < publishedAt). Penanda disimpan di DB, jadi kalau BE mati saat
//   waktunya tiba, scheduler mengejar saat start lagi. Jeda maksimal ~TICK_MS.
// - sekali saat tanggal WIB berganti: tag jadwal & katalog.
// Kalau BE berjalan lebih dari satu instance, revalidate bisa terpanggil ganda; itu aman.

export const TICK_MS = 30_000;
const BATCH = 200;

export async function revalidateDuePublications(now = new Date()): Promise<number> {
  const db = getDb();
  const due = await db.training.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      publishedAt: { lte: now },
      OR: [
        { publishRevalidatedAt: null },
        { publishRevalidatedAt: { lt: db.training.fields.publishedAt } },
      ],
    },
    select: { id: true, slug: true },
    orderBy: { publishedAt: "asc" },
    take: BATCH,
  });
  if (due.length === 0) return 0;

  const ok = await revalidateTags(
    tags(
      RevalidateTag.TRAININGS,
      RevalidateTag.CATEGORIES,
      RevalidateTag.SCHEDULES,
      ...due.map((row) => RevalidateTag.training(row.slug)),
    ),
  );
  // FE tidak bisa dihubungi: penanda tidak diisi supaya dicoba lagi di putaran berikutnya.
  if (!ok) return 0;

  await db.training.updateMany({
    where: { id: { in: due.map((row) => row.id) } },
    data: { publishRevalidatedAt: now },
  });
  return due.length;
}

// Mengembalikan tanggal WIB terbaru yang sudah di-revalidate (berubah = hari berganti).
export async function revalidateOnDayChange(lastDate: string | null, now = new Date()): Promise<string | null> {
  const today = appDateString(now);
  if (today === lastDate) return lastDate;
  const ok = await revalidateTags([RevalidateTag.SCHEDULES, RevalidateTag.TRAININGS]);
  return ok ? today : lastDate;
}

type SchedulerState = { timer: ReturnType<typeof setInterval>; lastDate: string | null; running: boolean };

const globalForScheduler = globalThis as typeof globalThis & { publishScheduler?: SchedulerState };

// Dipanggil dari instrumentation.ts. Singleton di globalThis supaya reload modul (HMR `next dev`)
// tidak membuat interval ganda.
export function startPublishScheduler(): void {
  if (globalForScheduler.publishScheduler) return;

  const state: SchedulerState = {
    lastDate: null,
    running: false,
    timer: setInterval(() => void tick(), TICK_MS),
  };
  // Interval tidak menahan proses tetap hidup (mis. saat shutdown).
  state.timer.unref?.();
  globalForScheduler.publishScheduler = state;

  async function tick() {
    if (state.running) return;
    state.running = true;
    try {
      await revalidateDuePublications();
      state.lastDate = await revalidateOnDayChange(state.lastDate);
    } catch (error) {
      console.warn("Scheduler publish gagal di putaran ini.", error);
    } finally {
      state.running = false;
    }
  }

  void tick();
}
