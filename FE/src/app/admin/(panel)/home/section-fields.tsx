"use client";

import type { ReactNode } from "react";
import { Controller, get, useFormContext, useWatch } from "react-hook-form";
import { FormField } from "@/components/admin/form-field";
import { HeroSlidesEditor } from "@/components/admin/hero-slides-editor";
import { ListEditor } from "@/components/admin/list-editor";
import { OptionMultiPicker } from "@/components/admin/option-multi-picker";
import { StringListEditor } from "@/components/admin/training-editors";
import { Checkbox } from "@/components/admin/ui/checkbox";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Switch } from "@/components/admin/ui/switch";
import { Textarea } from "@/components/admin/ui/textarea";
import { useScopedId } from "@/hooks/use-scoped-id";
import { categoryOptionSource, resourceOptionSource, type OptionSource } from "@/lib/admin-resources";
import type { Cta, HeroSlide, HomeSectionType, Media } from "@/lib/api/types";
import {
  HERO_INTERVAL_MAX_MS,
  HERO_INTERVAL_MIN_MS,
  HERO_SLIDES_MAX,
  MARQUEE_ITEMS_MAX,
  MARQUEE_ITEMS_MIN,
  ROTATING_WORDS_MAX,
  SELECTION_LIMITS,
  STATS_MAX,
  UPCOMING_LIMIT_MAX,
  type SelectionSectionType,
} from "@/lib/home-sections";

// Nilai form builder: isi section berbeda per type, jadi field diakses lewat path "content.<field>".
// Path yang sama dipakai error validasi form maupun error BE (content.items.1.label).
export type SectionFormValues = { title: string; visible: boolean; content: Record<string, unknown> };

const OPTION_SOURCES: Record<SelectionSectionType, { source: OptionSource; noun: string }> = {
  SERVICES: { source: resourceOptionSource("services"), noun: "layanan" },
  CATEGORIES: { source: categoryOptionSource, noun: "kategori" },
  LATEST_TRAININGS: { source: resourceOptionSource("trainings"), noun: "pelatihan" },
  CLIENTS: { source: resourceOptionSource("clients"), noun: "klien" },
  TESTIMONIALS: { source: resourceOptionSource("testimonials"), noun: "testimoni" },
};

function useFieldError(name: string): string | undefined {
  const { formState } = useFormContext<SectionFormValues>();
  const entry = get(formState.errors, name) as { message?: string } | undefined;
  return entry?.message;
}

function TextField({
  name,
  label,
  required,
  description,
  rows,
}: {
  name: `content.${string}`;
  label: string;
  required?: boolean;
  description?: string;
  rows?: number;
}) {
  const sid = useScopedId("field");
  const { control } = useFormContext<SectionFormValues>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormField id={sid(name)} label={label} required={required} description={description} error={error}>
          {rows ? (
            <Textarea rows={rows} value={(field.value as string) ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          ) : (
            <Input value={(field.value as string) ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
          )}
        </FormField>
      )}
    />
  );
}

function NumberField({ name, label, min, max, description }: { name: `content.${string}`; label: string; min: number; max: number; description?: string }) {
  const sid = useScopedId("field");
  const { control } = useFormContext<SectionFormValues>();
  const error = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormField id={sid(name)} label={label} description={description} error={error}>
          <Input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            className="w-32"
            value={Number.isFinite(field.value as number) ? (field.value as number) : ""}
            onChange={(event) => field.onChange(event.target.valueAsNumber)}
            onBlur={field.onBlur}
          />
        </FormField>
      )}
    />
  );
}

// Pilihan satu dari beberapa (radio berbingkai), mis. layout hero.
function RadioCards<T extends string>({ name, legend, options }: { name: `content.${string}`; legend: string; options: readonly (readonly [T, string, string])[] }) {
  const sid = useScopedId("radio");
  const { control } = useFormContext<SectionFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{legend}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {options.map(([value, label, help]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-fg-strong">
                <input
                  type="radio"
                  name={sid(name)}
                  checked={field.value === value}
                  onChange={() => field.onChange(value)}
                  className="mt-1 accent-[var(--fg-strong)]"
                />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-small text-fg-muted">{help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    />
  );
}

function SwitchField({ name, label, description }: { name: `content.${string}`; label: string; description?: string }) {
  const sid = useScopedId("switch");
  const { control } = useFormContext<SectionFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start gap-3">
          <Switch
            id={sid(name)}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
            aria-describedby={description ? sid(`${name}-help`) : undefined}
          />
          <div>
            <Label htmlFor={sid(name)}>{label}</Label>
            {description ? (
              <p id={sid(`${name}-help`)} className="mt-1 text-small text-fg-muted">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      )}
    />
  );
}

// Interval slideshow 4-10 detik (disimpan dalam ms).
function IntervalField() {
  const sid = useScopedId("interval");
  const { control } = useFormContext<SectionFormValues>();
  const error = useFieldError("content.intervalMs");
  return (
    <Controller
      control={control}
      name="content.intervalMs"
      render={({ field }) => {
        const seconds = Math.round(((field.value as number) || 6000) / 1000);
        return (
          <FormField id={sid("range")} label={`Ganti slide tiap ${seconds} detik`} description="4-10 detik. Pengunjung bisa menjeda." error={error}>
            <input
              type="range"
              min={HERO_INTERVAL_MIN_MS / 1000}
              max={HERO_INTERVAL_MAX_MS / 1000}
              step={1}
              value={seconds}
              onChange={(event) => field.onChange(event.target.valueAsNumber * 1000)}
              onBlur={field.onBlur}
              aria-valuetext={`${seconds} detik`}
              className="w-full max-w-sm accent-[var(--fg-strong)]"
            />
          </FormField>
        );
      }}
    />
  );
}

function HeroSlidesField({ media }: { media: Record<string, Media> }) {
  const { control, formState } = useFormContext<SectionFormValues>();
  return (
    <Controller
      control={control}
      name="content.slides"
      render={({ field }) => (
        <HeroSlidesEditor
          value={(field.value as HeroSlide[]) ?? []}
          onChange={field.onChange}
          media={media}
          max={HERO_SLIDES_MAX}
          errorFor={(index, key) => {
            const entry = get(formState.errors, key ? `content.slides.${index}.${key}` : `content.slides.${index}`) as { message?: string } | undefined;
            return entry?.message;
          }}
        />
      )}
    />
  );
}

function HeroBadgeFields() {
  const { control } = useFormContext<SectionFormValues>();
  const showBadge = Boolean(useWatch({ control, name: "content.showBadge" }));
  return (
    <>
      <SwitchField name="content.showBadge" label="Tampilkan badge berputar" description="Lingkaran teks berputar berisi tautan, di pojok hero." />
      {showBadge ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="content.badgeText" label="Teks badge" required description="Mis. Konsultasi gratis • Hubungi kami" />
          <TextField name="content.badgeHref" label="Tautan badge" required description="Mis. /kontak" />
        </div>
      ) : null}
    </>
  );
}

function Fieldset({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? <p className="mt-1 text-small text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

function HeadingFields({ withIntro }: { withIntro?: boolean }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <TextField name="content.eyebrow" label="Eyebrow" description="Label kecil di atas judul, mis. 01 / LAYANAN." />
        <TextField name="content.heading" label="Judul section" />
      </div>
      {withIntro ? <TextField name="content.intro" label="Pengantar" rows={2} /> : null}
    </>
  );
}

// Tombol CTA: label + tautan. Opsional = bisa dimatikan (disimpan null).
function CtaField({ name, label, optional }: { name: `content.${string}`; label: string; optional?: boolean }) {
  const sid = useScopedId("cta");
  const { control, setValue } = useFormContext<SectionFormValues>();
  const value = useWatch({ control, name }) as Cta | null;
  const enabled = value !== null && value !== undefined;
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-center gap-3">
        {optional ? (
          <Checkbox
            id={sid("enabled")}
            checked={enabled}
            onCheckedChange={(checked) =>
              setValue(name, checked ? { label: "", href: "" } : null, { shouldDirty: true, shouldValidate: false })
            }
          />
        ) : null}
        <Label htmlFor={optional ? sid("enabled") : undefined} className="text-sm font-medium">
          {label}
        </Label>
      </div>
      {enabled ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name={`${name}.label`} label="Label tombol" required />
          <TextField
            name={`${name}.href`}
            label="Tautan"
            required
            description="/pelatihan, https://, mailto:, atau tel:."
          />
        </div>
      ) : null}
    </div>
  );
}

function StringList({ name, itemName, addLabel, max, itemMax, placeholder }: { name: `content.${string}`; itemName: string; addLabel: string; max: number; itemMax: number; placeholder?: string }) {
  const { control, formState } = useFormContext<SectionFormValues>();
  const listError = useFieldError(name);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2">
          {listError ? <p className="text-small text-status-error">{listError}</p> : null}
          <StringListEditor
            value={(field.value as string[]) ?? []}
            onChange={field.onChange}
            errors={get(formState.errors, name)}
            max={max}
            itemMax={itemMax}
            itemName={itemName}
            addLabel={addLabel}
            placeholder={placeholder}
          />
        </div>
      )}
    />
  );
}

type StatItem = { value: number; prefix: string; suffix: string; label: string };

function StatsItems() {
  const sid = useScopedId("stat");
  const { control, formState } = useFormContext<SectionFormValues>();
  const listError = useFieldError("content.items");
  return (
    <Controller
      control={control}
      name="content.items"
      render={({ field }) => (
        <div className="space-y-2">
          {listError ? <p className="text-small text-status-error">{listError}</p> : null}
          <ListEditor<StatItem>
            value={(field.value as StatItem[]) ?? []}
            onChange={field.onChange}
            createItem={() => ({ value: 0, prefix: "", suffix: "", label: "" })}
            max={STATS_MAX}
            addLabel="Tambah angka"
            itemLabel={(_item, index) => `Angka ${index + 1}`}
            renderItem={({ item, index, update }) => {
              const error = (key: string) =>
                (get(formState.errors, `content.items.${index}.${key}`) as { message?: string } | undefined)?.message;
              return (
                <div className="grid flex-1 gap-3 sm:grid-cols-[90px_80px_80px_minmax(0,1fr)]">
                  <FormField id={sid(`${index}-value`)} label={`Angka ${index + 1}`} required error={error("value")}>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={Number.isFinite(item.value) ? item.value : ""}
                      onChange={(event) => update({ ...item, value: event.target.valueAsNumber })}
                    />
                  </FormField>
                  <FormField id={sid(`${index}-prefix`)} label="Awalan" error={error("prefix")}>
                    <Input value={item.prefix} onChange={(event) => update({ ...item, prefix: event.target.value })} />
                  </FormField>
                  <FormField id={sid(`${index}-suffix`)} label="Akhiran" error={error("suffix")}>
                    <Input
                      value={item.suffix}
                      placeholder="+"
                      onChange={(event) => update({ ...item, suffix: event.target.value })}
                    />
                  </FormField>
                  <FormField id={sid(`${index}-label`)} label={`Label ${index + 1}`} required error={error("label")}>
                    <Input value={item.label} onChange={(event) => update({ ...item, label: event.target.value })} />
                  </FormField>
                </div>
              );
            }}
          />
        </div>
      )}
    />
  );
}

function SelectionFields({ type }: { type: SelectionSectionType }) {
  const sid = useScopedId("selection");
  const { control } = useFormContext<SectionFormValues>();
  const mode = useWatch({ control, name: "content.mode" }) as "auto" | "manual";
  const idsError = useFieldError("content.ids");
  const { source, noun } = OPTION_SOURCES[type];
  const { maxLimit } = SELECTION_LIMITS[type];
  const autoHelp: Record<SelectionSectionType, string> = {
    SERVICES: "Layanan tayang sesuai urutan modul Layanan.",
    CATEGORIES: "Kategori unggulan yang punya pelatihan tayang.",
    LATEST_TRAININGS: "Pelatihan tayang terbaru.",
    CLIENTS: "Klien sesuai urutan modul Klien.",
    TESTIMONIALS: "Testimoni sesuai urutan modul Testimoni.",
  };
  return (
    <Fieldset title="Isi" description="Data diambil dari modulnya, bukan disalin.">
      <Controller
        control={control}
        name="content.mode"
        render={({ field }) => (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Sumber {noun}</legend>
            {(
              [
                ["auto", "Otomatis", autoHelp[type]],
                ["manual", "Pilih manual", `${noun[0].toUpperCase()}${noun.slice(1)} pilihan dengan urutan sendiri.`],
              ] as const
            ).map(([value, label, help]) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-fg-strong">
                <input
                  type="radio"
                  name={sid("mode")}
                  checked={field.value === value}
                  onChange={() => field.onChange(value)}
                  className="mt-1 accent-[var(--fg-strong)]"
                />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-small text-fg-muted">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      />
      {mode === "manual" ? (
        <Controller
          control={control}
          name="content.ids"
          render={({ field }) => (
            <OptionMultiPicker
              source={source}
              value={(field.value as string[]) ?? []}
              onChange={field.onChange}
              max={maxLimit}
              noun={noun}
              error={idsError}
            />
          )}
        />
      ) : (
        <NumberField name="content.limit" label={`Jumlah ${noun}`} min={1} max={maxLimit} description={`1-${maxLimit}.`} />
      )}
    </Fieldset>
  );
}

export function SectionFields({ type, media }: { type: HomeSectionType; media: Record<string, Media> }) {
  const sid = useScopedId("section-fields");
  const { control } = useFormContext<SectionFormValues>();

  switch (type) {
    case "HERO":
      return (
        <div className="space-y-6">
          <Fieldset title="Headline">
            <TextField name="content.eyebrow" label="Eyebrow" />
            <TextField name="content.headline" label="Headline" required />
            <div className="space-y-2">
              <p className="text-sm font-medium">Kata kunci berganti</p>
              <p className="text-small text-fg-muted">
                Opsional, maks {ROTATING_WORDS_MAX}. Kata pertama bagian dari headline; kata lain bergantian tiap 2 detik. Pengunjung bisa menjedanya, dan kata tidak berganti untuk pengunjung yang mengurangi animasi.
              </p>
              <StringList
                name="content.rotatingWords"
                itemName="Kata kunci"
                addLabel="Tambah kata kunci"
                max={ROTATING_WORDS_MAX}
                itemMax={30}
                placeholder="Mis. jadwal"
              />
            </div>
            <TextField name="content.subheadline" label="Subjudul" rows={2} />
          </Fieldset>
          <Fieldset title="Pencarian">
            <Controller
              control={control}
              name="content.showSearch"
              render={({ field }) => (
                <div className="flex items-center gap-3">
                  <Switch id={sid("search")} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  <Label htmlFor={sid("search")}>Tampilkan kotak pencarian pelatihan</Label>
                </div>
              )}
            />
            <TextField name="content.searchPlaceholder" label="Placeholder pencarian" />
          </Fieldset>
          <Fieldset title="Tombol">
            <CtaField name="content.primaryCta" label="Tombol utama" optional />
            <CtaField name="content.secondaryCta" label="Tombol kedua" optional />
          </Fieldset>
          <Fieldset
            title="Slide"
            description="0 slide = hero teks di latar putih. 1 slide = foto statis. 2-6 slide = berganti otomatis. Gambar asli tidak diubah."
          >
            <HeroSlidesField media={media} />
          </Fieldset>
          <Fieldset title="Tampilan slide">
            <RadioCards
              name="content.layout"
              legend="Layout"
              options={[
                ["fullbleed", "Penuh layar", "Foto memenuhi layar, teks terang di atasnya, header transparan."],
                ["split", "Terbagi", "Teks di kiri, foto di kanan, latar putih."],
              ]}
            />
            <IntervalField />
            <RadioCards
              name="content.photoStyle"
              legend="Warna foto"
              options={[
                ["color", "Berwarna", "Foto tampil apa adanya."],
                ["grayscale", "Hitam putih", "Hanya tampilan; file asli tidak diubah."],
              ]}
            />
            <SwitchField name="content.showViewfinder" label="Tampilkan bingkai viewfinder" description="Sudut bingkai, crosshair, dan label HUD di atas foto." />
            <HeroBadgeFields />
          </Fieldset>
        </div>
      );
    case "STATS":
      return (
        <div className="space-y-6">
          <Fieldset title="Judul">
            <HeadingFields />
          </Fieldset>
          <Fieldset title="Angka" description={`Maks ${STATS_MAX}. Urutkan dengan grip.`}>
            <StatsItems />
          </Fieldset>
        </div>
      );
    case "SERVICES":
    case "CATEGORIES":
    case "LATEST_TRAININGS":
      return (
        <div className="space-y-6">
          <Fieldset title="Judul">
            <HeadingFields withIntro />
          </Fieldset>
          <SelectionFields type={type} />
          <Fieldset title="Tombol">
            <CtaField name="content.cta" label="Tombol di bawah section" optional />
          </Fieldset>
        </div>
      );
    case "CLIENTS":
    case "TESTIMONIALS":
      return (
        <div className="space-y-6">
          <Fieldset title="Judul">
            <HeadingFields withIntro />
          </Fieldset>
          <SelectionFields type={type} />
        </div>
      );
    case "UPCOMING_SCHEDULES":
      return (
        <div className="space-y-6">
          <Fieldset title="Judul">
            <HeadingFields withIntro />
          </Fieldset>
          <Fieldset title="Isi" description="Sesi DIBUKA atau PENUH yang belum selesai (tanggal WIB), dari pelatihan tayang.">
            <NumberField name="content.limit" label="Jumlah sesi" min={1} max={UPCOMING_LIMIT_MAX} description={`1-${UPCOMING_LIMIT_MAX}.`} />
          </Fieldset>
          <Fieldset title="Tombol">
            <CtaField name="content.cta" label="Tombol di bawah section" optional />
          </Fieldset>
        </div>
      );
    case "VISION_MISSION":
      return (
        <div className="space-y-6">
          <Fieldset title="Isi">
            <TextField name="content.eyebrow" label="Eyebrow" />
            <TextField name="content.vision" label="Visi" required rows={3} />
            <div className="space-y-2">
              <p className="text-sm font-medium">Misi</p>
              <StringList name="content.mission" itemName="Misi" addLabel="Tambah misi" max={10} itemMax={300} />
            </div>
            <TextField name="content.motto" label="Moto" />
          </Fieldset>
        </div>
      );
    case "CTA":
      return (
        <div className="space-y-6">
          <Fieldset title="Isi">
            <TextField name="content.eyebrow" label="Eyebrow" />
            <TextField name="content.heading" label="Judul section" required />
            <TextField name="content.body" label="Isi" rows={3} />
          </Fieldset>
          <Fieldset title="Tombol">
            <CtaField name="content.primaryCta" label="Tombol utama" />
            <CtaField name="content.secondaryCta" label="Tombol kedua" optional />
          </Fieldset>
        </div>
      );
    case "MARQUEE":
      return <MarqueeFields />;
  }
}

// Teks berjalan: teks sendiri atau judul layanan tayang (sesuai urutan modul Layanan).
function MarqueeFields() {
  const sid = useScopedId("marquee");
  const { control } = useFormContext<SectionFormValues>();
  const source = useWatch({ control, name: "content.source" }) as "custom" | "services";
  return (
    <div className="space-y-6">
      <Fieldset title="Isi" description="Teks besar bergerak mengikuti scroll, solid dan outline berselang-seling.">
        <Controller
          control={control}
          name="content.source"
          render={({ field }) => (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Sumber teks</legend>
              {(
                [
                  ["services", "Ambil dari judul layanan", "Judul layanan tayang sesuai urutan modul Layanan; ikut berubah saat layanan diubah."],
                  ["custom", "Teks sendiri", `${MARQUEE_ITEMS_MIN}-${MARQUEE_ITEMS_MAX} teks pendek, mis. BNSP, In House, Public Training.`],
                ] as const
              ).map(([value, label, help]) => (
                <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-fg-strong">
                  <input
                    type="radio"
                    name={sid("source")}
                    checked={field.value === value}
                    onChange={() => field.onChange(value)}
                    className="mt-1 accent-[var(--fg-strong)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-small text-fg-muted">{help}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        />
        {source === "custom" ? (
          <StringList
            name="content.items"
            itemName="Teks"
            addLabel="Tambah teks"
            max={MARQUEE_ITEMS_MAX}
            itemMax={40}
            placeholder="Mis. Sertifikasi BNSP"
          />
        ) : (
          <NumberField
            name="content.limit"
            label="Jumlah layanan"
            min={MARQUEE_ITEMS_MIN}
            max={MARQUEE_ITEMS_MAX}
            description={`${MARQUEE_ITEMS_MIN}-${MARQUEE_ITEMS_MAX}.`}
          />
        )}
      </Fieldset>
      <Fieldset title="Aksesibilitas">
        <TextField name="content.heading" label="Judul untuk pembaca layar" description="Tidak tampil di layar, mis. Bidang layanan." />
      </Fieldset>
    </div>
  );
}
