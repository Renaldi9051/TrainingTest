"use client";

import { SearchIcon } from "lucide-react";
import Form from "next/form";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gridHref } from "@/lib/category-grid-url";

const DEBOUNCE_MS = 300;

// Kotak "Cari kategori" di kepala /pelatihan. Form GET ?q= (tetap jalan tanpa JavaScript); dengan JS,
// ketikan dikirim setelah jeda 300 ms lewat router.replace (tanpa reload penuh, halaman kembali ke 1).
// Nilai awal dibaca dari URL sekali; setelah itu input milik pengguna (tidak ditimpa saat hasil datang).
export function CategorySearch() {
  const router = useRouter();
  const initial = useSearchParams().get("q") ?? "";
  const [value, setValue] = useState(initial);
  const sent = useRef(initial.trim());

  useEffect(() => {
    const q = value.replace(/\s+/g, " ").trim();
    if (q === sent.current) return;
    const timer = window.setTimeout(() => {
      sent.current = q;
      router.replace(gridHref({ q, page: 1 }), { scroll: false });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value, router]);

  return <CategorySearchForm value={value} onChange={setValue} />;
}

// Kerangka yang sama untuk fallback Suspense (sebelum URL terbaca) dan tanpa JavaScript.
export function CategorySearchForm({ value, onChange }: { value?: string; onChange?: (value: string) => void }) {
  return (
    <Form action="/pelatihan" role="search">
      <label
        htmlFor="category-q"
        className="mb-2 block font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-muted"
      >
        Cari kategori
      </label>
      <div className="flex h-14 items-center gap-3 rounded-md border border-fg-strong bg-bg px-4 focus-within:ring-2 focus-within:ring-focus focus-within:ring-offset-2">
        <SearchIcon className="size-5 shrink-0 text-fg-muted" strokeWidth={1.5} aria-hidden />
        <input
          id="category-q"
          name="q"
          type="search"
          autoComplete="off"
          maxLength={100}
          placeholder="Ketik nama kategori, misal K3 atau pajak"
          className="h-full min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
          {...(onChange ? { value, onChange: (event) => onChange(event.target.value) } : { defaultValue: value })}
        />
      </div>
    </Form>
  );
}
