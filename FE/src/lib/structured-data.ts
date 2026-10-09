import type { PublicTrainingDetail, ScheduleStatus, TrainingMethod } from "@/lib/api/types";

// JSON-LD schema.org untuk SEO (PRD 8): Course di detail pelatihan, Event per jadwal.

type EventInput = {
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: TrainingMethod;
  price: number | null;
  status: ScheduleStatus;
};

const ATTENDANCE: Record<TrainingMethod, string> = {
  ONLINE: "https://schema.org/OnlineEventAttendanceMode",
  OFFLINE: "https://schema.org/OfflineEventAttendanceMode",
  HYBRID: "https://schema.org/MixedEventAttendanceMode",
};

const COURSE_MODE: Record<TrainingMethod, string> = { ONLINE: "Online", OFFLINE: "Onsite", HYBRID: "Blended" };

function absolute(siteUrl: string, path: string): string {
  return new URL(path, siteUrl).toString();
}

function eventLocation(event: EventInput, siteUrl: string) {
  const place = {
    "@type": "Place",
    name: event.venue ?? event.city ?? "Lokasi menyusul",
    address: { "@type": "PostalAddress", addressLocality: event.city ?? undefined, addressCountry: "ID" },
  };
  const virtual = { "@type": "VirtualLocation", url: absolute(siteUrl, `/pelatihan/${event.slug}`) };
  if (event.method === "ONLINE") return virtual;
  if (event.method === "HYBRID") return [place, virtual];
  return place;
}

export function scheduleEventJsonLd(event: EventInput, siteUrl: string, organizer: string) {
  const url = absolute(siteUrl, `/pelatihan/${event.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: ATTENDANCE[event.method],
    location: eventLocation(event, siteUrl),
    organizer: { "@type": "Organization", name: organizer, url: siteUrl },
    url,
    // Harga hanya kalau pelatihan menampilkannya (showPrice); null tidak pernah dikirim BE.
    ...(event.price !== null
      ? {
          offers: {
            "@type": "Offer",
            price: event.price,
            priceCurrency: "IDR",
            availability:
              event.status === "OPEN" ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
            url,
          },
        }
      : {}),
  };
}

export function courseJsonLd(training: PublicTrainingDetail, siteUrl: string, provider: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: training.title,
    description: training.seo.description || training.summary || training.title,
    url: absolute(siteUrl, `/pelatihan/${training.slug}`),
    provider: { "@type": "Organization", name: provider, sameAs: siteUrl },
    ...(training.cover ? { image: absolute(siteUrl, training.cover.url) } : {}),
    ...(training.categories.length > 0 ? { about: training.categories.map((category) => category.name) } : {}),
    ...(training.outcomes.length > 0 ? { teaches: training.outcomes } : {}),
    ...(training.modules.length > 0
      ? {
          syllabusSections: training.modules.map((module) => ({
            "@type": "Syllabus",
            name: module.title,
            ...(module.points.length > 0 ? { description: module.points.join("; ") } : {}),
            ...(module.durationMinutes ? { timeRequired: `PT${module.durationMinutes}M` } : {}),
          })),
        }
      : {}),
    ...(training.prerequisites ? { coursePrerequisites: training.prerequisites } : {}),
    ...(training.schedules.length > 0
      ? {
          hasCourseInstance: training.schedules
            .filter((schedule) => schedule.status !== "COMPLETED")
            .map((schedule) => ({
              "@type": "CourseInstance",
              courseMode: COURSE_MODE[schedule.method],
              startDate: schedule.startDate,
              endDate: schedule.endDate,
              ...(schedule.city ? { location: schedule.city } : {}),
            })),
        }
      : {}),
  };
}

// Pesan otomatis tombol WhatsApp di detail pelatihan.
export function whatsappTrainingUrl(number: string, title: string): string {
  const message = `Halo, saya tertarik dengan pelatihan "${title}". Mohon info jadwal dan investasinya.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

// Sementara (sampai form inquiry Fase 4): permintaan penawaran in-house lewat WhatsApp.
export function whatsappInHouseUrl(number: string, title: string): string {
  const message = `Halo, kami ingin meminta penawaran pelatihan in-house "${title}" untuk tim kami. Mohon info selanjutnya.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
