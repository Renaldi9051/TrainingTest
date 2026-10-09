"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api/client";
import type { SlugCheckResult } from "@/lib/api/types";
import { slugify } from "@/lib/slug";

type SlugFieldProps = {
  id: string;
  entity: "category" | "training";
  value: string;
  onChange: (value: string) => void;
  // Judul/nama sumber slug otomatis.
  source: string;
  // true = slug masih mengikuti judul (form baru, belum diedit manual).
  auto: boolean;
  onAutoChange: (auto: boolean) => void;
  // Id item yang sedang diedit, supaya slug miliknya sendiri tidak dianggap bentrok.
  excludeId?: string;
  // Path publik sebelum slug, mis. "/pelatihan/".
  prefix: string;
  error?: string;
  // Peringatan saat slug konten yang sudah published diubah.
  publishedSlug?: string | null;
};

export function SlugField({
  id,
  entity,
  value,
  onChange,
  source,
  auto,
  onAutoChange,
  excludeId,
  prefix,
  error,
  publishedSlug,
}: SlugFieldProps) {
  useEffect(() => {
    if (!auto) return;
    const next = slugify(source);
    if (next !== value) onChange(next);
  }, [auto, source, value, onChange]);

  const slug = useDebouncedValue(value.trim());
  const check = useQuery({
    queryKey: ["admin", "slug-check", entity, slug, excludeId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams({ entity, slug });
      if (excludeId) params.set("excludeId", excludeId);
      return (await apiFetch<SlugCheckResult>(`/admin/slugs/check?${params}`)).data;
    },
    enabled: slug !== "",
    staleTime: 10_000,
  });

  const statusId = `${id}-status`;
  const errorId = `${id}-error`;
  const checking = value.trim() !== slug || check.isFetching;
  const result = check.data;
  const changedPublished = Boolean(publishedSlug && value && value !== publishedSlug);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>Slug</Label>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => {
            onAutoChange(true);
            onChange(slugify(source));
          }}
          disabled={!source.trim()}
        >
          <RefreshCwIcon aria-hidden />
          Buat dari judul
        </Button>
      </div>
      <div className="flex items-center rounded-md border border-input focus-within:border-ring focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 aria-invalid:border-destructive">
        <span className="hidden shrink-0 pl-3 font-mono text-xs text-fg-muted sm:inline" aria-hidden>
          {prefix}
        </span>
        <Input
          id={id}
          value={value}
          onChange={(event) => {
            onAutoChange(false);
            onChange(event.target.value.toLowerCase());
          }}
          onBlur={() => {
            const cleaned = slugify(value);
            if (cleaned && cleaned !== value) onChange(cleaned);
          }}
          className="border-0 font-mono focus-visible:ring-0 focus-visible:ring-offset-0 sm:pl-1"
          aria-invalid={error || (result && !result.available) ? true : undefined}
          aria-describedby={[statusId, error ? errorId : null].filter(Boolean).join(" ")}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <p id={statusId} className="min-h-5 text-small text-fg-muted" aria-live="polite">
        {!value.trim() ? (
          "Kosongkan untuk dibuat otomatis dari judul."
        ) : checking ? (
          <span className="inline-flex items-center gap-1">
            <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> Memeriksa slug...
          </span>
        ) : result && !result.valid ? (
          <span className="text-status-error">{result.message}</span>
        ) : result && !result.available ? (
          <span className="text-status-error">
            {result.message}{" "}
            {result.suggestion ? (
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => {
                  onAutoChange(false);
                  onChange(result.suggestion ?? "");
                }}
              >
                Pakai {result.suggestion}
              </button>
            ) : null}
          </span>
        ) : result?.available ? (
          <span className="inline-flex items-center gap-1 text-status-success">
            <CheckIcon className="size-3.5" aria-hidden /> Slug tersedia
          </span>
        ) : null}
      </p>
      {changedPublished ? (
        <p className="text-small text-status-warning">
          Slug konten yang sudah tayang akan berubah. Alamat lama otomatis dicatat untuk redirect 301.
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-small text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
