"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, ExternalLinkIcon, ImagePlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/admin/form-field";
import { mediaPreviewKey, MediaPickerDialog } from "@/components/admin/media/media-picker";
import { MediaThumbnail } from "@/components/admin/media/media-thumbnail";
import { isMissingAlt, mediaName } from "@/components/admin/media/media-utils";
import { SortableList } from "@/components/admin/sortable-list";
import { Button } from "@/components/admin/ui/button";
import { Input } from "@/components/admin/ui/input";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { useScopedId } from "@/hooks/use-scoped-id";
import { apiFetch } from "@/lib/api/client";
import type { HeroSlide, Media } from "@/lib/api/types";
import { focalFromPoint } from "@/lib/home-sections";

type HeroSlidesEditorProps = {
  value: HeroSlide[];
  onChange: (slides: HeroSlide[]) => void;
  // Media dari respons BE (section.media), supaya thumbnail tidak perlu fetch ulang.
  media: Record<string, Media>;
  // Error per field slide (content.slides.N.<field>) dari form atau BE.
  errorFor: (index: number, field: keyof HeroSlide | "") => string | undefined;
  max: number;
};

const newSlide = (mediaId: string): HeroSlide => ({ mediaId, alt: "", caption: "", href: "", hudLabel: "", focalX: 50, focalY: 50 });

// Editor slide hero (DESIGN.md 11): daftar thumbnail yang bisa di-drag (atau keyboard) untuk urutan,
// "Tambah slide" membuka media library, per slide: alt, caption, tautan, label HUD, titik fokus (klik
// di gambar atau isi angka) dengan pratinjau potongan desktop & mobile. Slide tidak mengubah file
// gambar; titik fokus hanya posisi potongan (object-position).
export function HeroSlidesEditor({ value, onChange, media, errorFor, max }: HeroSlidesEditorProps) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const items = value.map((slide) => ({ id: slide.mediaId }));
  const full = value.length >= max;
  const update = (index: number, change: Partial<HeroSlide>) =>
    onChange(value.map((slide, current) => (current === index ? { ...slide, ...change } : slide)));

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center text-small text-fg-muted">
          Belum ada slide. Hero tampil sebagai teks di latar putih sampai slide ditambahkan.
        </p>
      ) : (
        <SortableList
          items={items}
          itemLabel={(item) => `slide ${value.findIndex((slide) => slide.mediaId === item.id) + 1}`}
          onReorder={(ids) => onChange(ids.map((id) => value.find((slide) => slide.mediaId === id) ?? newSlide(id)))}
          renderItem={(item, handle) => {
            const index = value.findIndex((slide) => slide.mediaId === item.id);
            return (
              <SlideRow
                slide={value[index]}
                index={index}
                handle={handle}
                initial={media[item.id]}
                errorFor={(field) => errorFor(index, field)}
                onChange={(change) => update(index, change)}
                onRemove={() => onChange(value.filter((_, current) => current !== index))}
              />
            );
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => setPicking(true)}>
          <ImagePlusIcon aria-hidden />
          Tambah slide
        </Button>
        <p className="text-small text-fg-muted">
          {value.length}/{max} slide. Disarankan foto landscape, lebar minimal 1600 px.
        </p>
      </div>
      {picking ? (
        <MediaPickerDialog
          title="Tambah slide dari media library"
          currentId={null}
          onClose={() => setPicking(false)}
          onSelect={(picked) => {
            setPicking(false);
            if (value.some((slide) => slide.mediaId === picked.id)) {
              toast.error("Gambar itu sudah dipakai di slide lain.");
              return;
            }
            queryClient.setQueryData(mediaPreviewKey(picked.id), picked);
            onChange([...value, newSlide(picked.id)]);
          }}
        />
      ) : null}
    </div>
  );
}

function SlideRow({
  slide,
  index,
  handle,
  initial,
  errorFor,
  onChange,
  onRemove,
}: {
  slide: HeroSlide;
  index: number;
  handle: ReactNode;
  initial?: Media;
  errorFor: (field: keyof HeroSlide | "") => string | undefined;
  onChange: (change: Partial<HeroSlide>) => void;
  onRemove: () => void;
}) {
  const sid = useScopedId(`slide-${index}`);
  // staleTime 0: kembali dari tab media library setelah mengisi alt = data alt terbaru.
  const query = useQuery({
    queryKey: mediaPreviewKey(slide.mediaId),
    queryFn: async () => (await apiFetch<Media>(`/admin/media/${slide.mediaId}`)).data,
    initialData: initial,
    staleTime: 0,
  });
  const media = query.data;
  // Alt slide kosong = alt media dipakai, jadi media wajib punya alt.
  const missingAlt = media ? !slide.alt.trim() && isMissingAlt(media) : false;
  const rowError = errorFor("") ?? errorFor("mediaId");
  const hasFieldError = (["alt", "caption", "href", "hudLabel", "focalX", "focalY"] as const).some((field) => errorFor(field));
  const position = `${slide.focalX}% ${slide.focalY}%`;
  const label = String(index + 1).padStart(2, "0");
  const [openState, setOpen] = useState(false);
  // Field dengan error selalu terbuka supaya error terlihat.
  const open = openState || hasFieldError;

  return (
    <div className="border-b border-border py-2 last:border-b-0">
      <div className="flex items-start gap-3">
        {handle}
        <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-md border border-border bg-bg-muted">
          {media ? (
            <Image src={media.url} alt="" fill sizes="112px" className="object-cover" style={{ objectPosition: position }} />
          ) : query.isError ? (
            <div className="flex h-full items-center justify-center text-[10px] text-status-error">Hilang</div>
          ) : (
            <Skeleton className="absolute inset-0 rounded-none" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-medium text-fg-strong">
            <span className="mr-2 font-mono text-xs text-fg-muted">{label}</span>
            {media ? mediaName(media) : query.isError ? "Gambar tidak ditemukan atau sudah dihapus" : "Memuat..."}
          </p>
          <p className="truncate text-small text-fg-muted">
            {slide.caption || "Tanpa caption"}
            {slide.hudLabel ? ` · ${slide.hudLabel}` : ""}
            {media?.width && media.height ? ` · ${media.width}×${media.height}` : ""}
          </p>
          {missingAlt ? (
            <p className="flex flex-wrap items-center gap-x-2 text-small text-status-warning">
              <TriangleAlertIcon className="size-3.5" strokeWidth={1.5} aria-hidden />
              Isi alt slide, atau isi alt gambar di media library.
            </p>
          ) : null}
          {rowError ? (
            <p role="alert" className="text-small text-status-error">
              {rowError}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={sid("panel")}
          aria-label={`Atur slide ${label}`}
          onClick={() => setOpen(!open)}
        >
          Atur
          <ChevronDownIcon className={open ? "rotate-180 transition-transform" : "transition-transform"} strokeWidth={1.5} aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={`Lepas slide ${label}`} onClick={onRemove}>
          <XIcon aria-hidden />
        </Button>
      </div>

      <div id={sid("panel")} hidden={!open} className="mt-4 grid gap-6 pb-4 pl-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <FormField
            id={sid("alt")}
            label="Alt slide"
            description={media?.alt ? `Kosongkan untuk memakai alt gambar: "${media.alt}".` : "Wajib kalau gambar belum punya alt di media library."}
            error={errorFor("alt")}
          >
            <Input value={slide.alt} maxLength={200} onChange={(event) => onChange({ alt: event.target.value })} />
          </FormField>
          <FormField id={sid("caption")} label="Caption" description="Opsional, mis. nama pelatihan. Tampil di bar indikator." error={errorFor("caption")}>
            <Input value={slide.caption} maxLength={80} onChange={(event) => onChange({ caption: event.target.value })} />
          </FormField>
          <FormField id={sid("href")} label="Tautan caption" description="Opsional, mis. /pelatihan/pilot-drone-dasar." error={errorFor("href")}>
            <Input value={slide.href} maxLength={500} onChange={(event) => onChange({ href: event.target.value })} />
          </FormField>
          <FormField
            id={sid("hud")}
            label="Label HUD"
            description="Opsional, data nyata, mis. LOKASI / SLEMAN. Tampil di sudut bingkai viewfinder."
            error={errorFor("hudLabel")}
          >
            <Input value={slide.hudLabel} maxLength={40} onChange={(event) => onChange({ hudLabel: event.target.value })} />
          </FormField>
          {media?.alt === null || media?.alt === "" ? (
            <Link
              href={`/admin/media?media=${slide.mediaId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-small text-fg-strong underline underline-offset-4"
            >
              Isi alt di media library
              <ExternalLinkIcon className="size-3" aria-hidden />
              <span className="sr-only">(tab baru)</span>
            </Link>
          ) : null}
        </div>

        <FocalPicker slide={slide} media={media} errorFor={errorFor} onChange={onChange} />
      </div>
    </div>
  );
}

// Titik fokus: klik di gambar utuh, atau isi angka (keyboard). Pratinjau potongan desktop (16:9) dan
// mobile (9:16) memakai object-position yang sama dengan halaman publik.
function FocalPicker({
  slide,
  media,
  errorFor,
  onChange,
}: {
  slide: HeroSlide;
  media: Media | undefined;
  errorFor: (field: keyof HeroSlide | "") => string | undefined;
  onChange: (change: Partial<HeroSlide>) => void;
}) {
  const sid = useScopedId("focal");
  const position = `${slide.focalX}% ${slide.focalY}%`;
  const ratio = media?.width && media.height ? `${media.width} / ${media.height}` : "16 / 9";
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Titik fokus</p>
      <p className="text-small text-fg-muted">Klik bagian gambar yang harus selalu terlihat saat dipotong di layar lebar maupun ponsel.</p>
      <div
        className="relative w-full cursor-crosshair overflow-hidden rounded-md border border-border bg-bg-muted"
        style={{ aspectRatio: ratio }}
        onClick={(event) => onChange(focalFromPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect()))}
      >
        {media ? <MediaThumbnail media={media} sizes="(min-width: 1024px) 400px, 100vw" fit="contain" /> : null}
        <span
          aria-hidden
          className="pointer-events-none absolute size-5 -translate-1/2 rounded-full border-2 border-inverse-fg bg-fg-strong/40"
          style={{ left: `${slide.focalX}%`, top: `${slide.focalY}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField id={sid("x")} label="Horizontal (%)" error={errorFor("focalX")}>
          <Input
            type="number"
            min={0}
            max={100}
            value={slide.focalX}
            onChange={(event) => onChange({ focalX: event.target.valueAsNumber })}
          />
        </FormField>
        <FormField id={sid("y")} label="Vertikal (%)" error={errorFor("focalY")}>
          <Input
            type="number"
            min={0}
            max={100}
            value={slide.focalY}
            onChange={(event) => onChange({ focalY: event.target.valueAsNumber })}
          />
        </FormField>
      </div>
      {media ? (
        <div className="flex items-end gap-3" aria-label="Pratinjau potongan">
          <figure className="space-y-1">
            <div className="relative aspect-video w-40 overflow-hidden rounded-md border border-border bg-bg-muted">
              <Image src={media.url} alt="" fill sizes="160px" className="object-cover" style={{ objectPosition: position }} />
            </div>
            <figcaption className="text-[11px] text-fg-muted">Desktop</figcaption>
          </figure>
          <figure className="space-y-1">
            <div className="relative aspect-[9/16] w-16 overflow-hidden rounded-md border border-border bg-bg-muted">
              <Image src={media.url} alt="" fill sizes="64px" className="object-cover" style={{ objectPosition: position }} />
            </div>
            <figcaption className="text-[11px] text-fg-muted">Ponsel</figcaption>
          </figure>
        </div>
      ) : null}
    </div>
  );
}
