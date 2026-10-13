"use client";

import { useEffect, useState } from "react";
import type { InquiryTraining } from "./inquiry-form";
import { InquiryForm } from "./inquiry-form";

// Form inquiry halaman /kontak. ?pelatihan=<slug> mengisi pelatihan otomatis. Dibaca di klien
// (bukan saat prerender) supaya /kontak tetap statis; slug yang tidak ada/tidak tayang diabaikan.
export function ContactInquiry({ siteName, privacyHref }: { siteName: string; privacyHref: string | null }) {
  const [training, setTraining] = useState<InquiryTraining | null>(null);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("pelatihan")?.trim();
    if (!slug || !/^[a-z0-9-]{1,200}$/.test(slug)) return;
    const controller = new AbortController();
    fetch(`/api/public/trainings/${encodeURIComponent(slug)}`, { signal: controller.signal, headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? (response.json() as Promise<{ data: { slug: string; title: string } }>) : null))
      .then((body) => {
        if (body) setTraining({ slug: body.data.slug, title: body.data.title });
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <InquiryForm key={training?.slug ?? "-"} siteName={siteName} privacyHref={privacyHref} source="CONTACT" training={training} />
  );
}
