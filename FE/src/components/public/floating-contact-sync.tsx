"use client";

import { useEffect } from "react";
import { currentContactTopic } from "@/lib/contact-context";
import { marketingMessage, whatsappLink } from "@/lib/whatsapp";

// Pelengkap kecil FloatingContact (tanpa UI):
// 1. Browser tanpa Popover API: tandai html[data-popover="off"] supaya CSS menampilkan tautan /kontak.
// 2. Saat panel dibuka: pesan WA tiap marketing mengikuti halaman yang sedang dibuka (judul pelatihan/
//    layanan dari ContactContext). Dibaca saat dibuka, jadi tetap benar setelah navigasi klien.
export function FloatingContactSync({ panelId }: { panelId: string }) {
  useEffect(() => {
    if (!("popover" in HTMLElement.prototype)) {
      document.documentElement.dataset.popover = "off";
      return;
    }
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const onBeforeToggle = (event: Event) => {
      if (!(event instanceof ToggleEvent) || event.newState !== "open") return;
      const topic = currentContactTopic();
      for (const link of panel.querySelectorAll<HTMLAnchorElement>("a[data-wa-phone]")) {
        const { waPhone, waName, waDefault } = link.dataset;
        if (!waPhone || !waName) continue;
        link.href = whatsappLink(waPhone, marketingMessage({ name: waName, defaultMessage: waDefault ?? null }, topic));
      }
    };
    panel.addEventListener("beforetoggle", onBeforeToggle);
    return () => panel.removeEventListener("beforetoggle", onBeforeToggle);
  }, [panelId]);

  return null;
}
