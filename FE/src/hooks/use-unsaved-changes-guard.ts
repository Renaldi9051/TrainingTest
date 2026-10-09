"use client";

import { useEffect } from "react";

const DEFAULT_MESSAGE = "Ada perubahan yang belum disimpan. Tinggalkan halaman ini?";

// Peringatan saat meninggalkan form yang belum disimpan.
// - Tutup tab / reload / pindah ke situs lain: beforeunload (dialog bawaan browser).
// - Klik link internal (next/link): dicegat di fase capture sebelum router Next menanganinya.
// App Router belum punya API pemblokir navigasi, jadi tombol Back browser tidak tercegat.
export function useUnsavedChangesGuard(dirty: boolean, message = DEFAULT_MESSAGE): void {
  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      // Link ke origin lain = navigasi penuh, sudah ditangani beforeunload.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
