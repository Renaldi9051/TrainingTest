"use client";

import { useId } from "react";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import type { Media } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export type SeoValue = { title: string; description: string; ogImageId: string | null };

export const SEO_TITLE_MAX = 70;
export const SEO_DESCRIPTION_MAX = 160;

type SeoPanelProps = {
  value: SeoValue;
  onChange: (value: SeoValue) => void;
  // Ditampilkan sebagai placeholder: nilai yang dipakai kalau field SEO dikosongkan.
  fallbackTitle?: string;
  fallbackDescription?: string;
  ogImage?: Media | null;
  errors?: Partial<Record<keyof SeoValue, string>>;
};

function Counter({ id, length, max }: { id: string; length: number; max: number }) {
  return (
    <span id={id} className={cn("font-mono text-xs", length > max ? "text-status-error" : "text-fg-muted")}>
      {length}/{max}
    </span>
  );
}

// Judul & deskripsi SEO dengan penghitung karakter, plus gambar OG.
export function SeoPanel({
  value,
  onChange,
  fallbackTitle,
  fallbackDescription,
  ogImage,
  errors,
}: SeoPanelProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;
  const ogId = `${baseId}-og`;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={titleId}>Judul SEO</Label>
          <Counter id={`${titleId}-count`} length={value.title.length} max={SEO_TITLE_MAX} />
        </div>
        <Input
          id={titleId}
          value={value.title}
          placeholder={fallbackTitle}
          aria-describedby={`${titleId}-count${errors?.title ? ` ${titleId}-error` : ""}`}
          aria-invalid={errors?.title || value.title.length > SEO_TITLE_MAX ? true : undefined}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
        {errors?.title ? (
          <p id={`${titleId}-error`} className="text-small text-status-error">
            {errors.title}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={descriptionId}>Deskripsi SEO</Label>
          <Counter
            id={`${descriptionId}-count`}
            length={value.description.length}
            max={SEO_DESCRIPTION_MAX}
          />
        </div>
        <Textarea
          id={descriptionId}
          rows={3}
          value={value.description}
          placeholder={fallbackDescription}
          aria-describedby={`${descriptionId}-count${errors?.description ? ` ${descriptionId}-error` : ""}`}
          aria-invalid={errors?.description || value.description.length > SEO_DESCRIPTION_MAX ? true : undefined}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
        {errors?.description ? (
          <p id={`${descriptionId}-error`} className="text-small text-status-error">
            {errors.description}
          </p>
        ) : null}
        <p className="text-small text-fg-muted">Kosongkan untuk memakai judul dan ringkasan konten.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={ogId}>Gambar OG</Label>
        <MediaPicker
          id={ogId}
          value={value.ogImageId}
          initialMedia={ogImage}
          onChange={(ogImageId) => onChange({ ...value, ogImageId })}
          aspect="16/9"
          dialogTitle="Pilih gambar OG"
          aria-invalid={errors?.ogImageId ? true : undefined}
        />
        {errors?.ogImageId ? <p className="text-small text-status-error">{errors.ogImageId}</p> : null}
        <p className="text-small text-fg-muted">Tampil saat tautan dibagikan. Kosong = pakai gambar sampul.</p>
      </div>
    </div>
  );
}
