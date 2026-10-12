"use client";

import type { ReactNode } from "react";
import { FormField } from "@/components/admin/form-field";
import { ListEditor } from "@/components/admin/list-editor";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { OptionMultiPicker } from "@/components/admin/option-multi-picker";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { StringListEditor } from "@/components/admin/training-editors";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/admin/ui/select";
import { Textarea } from "@/components/admin/ui/textarea";
import { useScopedId } from "@/hooks/use-scoped-id";
import type { Media, PageBlock } from "@/lib/api/types";
import { CATEGORY_ICON_NAMES, CATEGORY_ICONS } from "@/lib/category-icons";
import { FEATURES_MAX, LIST_ITEMS_MAX, MISSION_ITEMS_MAX, SERVICES_LIMIT_MAX } from "@/lib/page-blocks";

// Error RHF untuk satu blok: errors.blocks[N] berbentuk { field: { message } | array }.
export type BlockErrors = Record<string, unknown> | undefined;

function message(errors: BlockErrors, field: string): string | undefined {
  const entry = errors?.[field];
  return entry && typeof entry === "object" && "message" in entry ? String((entry as { message: unknown }).message) : undefined;
}

type FieldsProps<T extends PageBlock> = {
  block: T;
  onChange: (block: PageBlock) => void;
  errors: BlockErrors;
  media: Record<string, Media>;
};

function HeadingFields<T extends Extract<PageBlock, { eyebrow: string; heading: string }>>({
  block,
  onChange,
  errors,
  sid,
}: {
  block: T;
  onChange: (block: T) => void;
  errors: BlockErrors;
  sid: (name: string) => string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <FormField id={sid("eyebrow")} label="Eyebrow" description="Label kecil di atas judul, opsional." error={message(errors, "eyebrow")}>
        <Input value={block.eyebrow} onChange={(event) => onChange({ ...block, eyebrow: event.target.value })} />
      </FormField>
      <FormField id={sid("heading")} label="Judul blok" error={message(errors, "heading")}>
        <Input value={block.heading} onChange={(event) => onChange({ ...block, heading: event.target.value })} />
      </FormField>
    </div>
  );
}

// Field sesuai jenis blok. Semua input terkontrol: setiap perubahan mengganti objek blok.
export function BlockFields({ block, onChange, errors, media }: FieldsProps<PageBlock>) {
  const sid = useScopedId(`block-${block.type.toLowerCase()}`);
  let fields: ReactNode;
  switch (block.type) {
    case "RICH_TEXT":
      fields = (
        <>
          <HeadingFields block={block} onChange={onChange} errors={errors} sid={sid} />
          <FormField id={sid("body")} label="Isi" error={message(errors, "body")}>
            <RichTextEditor value={block.body} onChange={(body) => onChange({ ...block, body })} aria-label="Isi teks" />
          </FormField>
        </>
      );
      break;
    case "VISION_MISSION":
      fields = (
        <>
          <FormField id={sid("eyebrow")} label="Eyebrow" error={message(errors, "eyebrow")}>
            <Input value={block.eyebrow} onChange={(event) => onChange({ ...block, eyebrow: event.target.value })} />
          </FormField>
          <FormField id={sid("vision")} label="Visi" required error={message(errors, "vision")}>
            <Textarea rows={3} value={block.vision} onChange={(event) => onChange({ ...block, vision: event.target.value })} />
          </FormField>
          <div className="space-y-2">
            <p className="text-sm font-medium">Misi</p>
            {message(errors, "mission") ? (
              <p className="text-small text-status-error">{message(errors, "mission")}</p>
            ) : null}
            <StringListEditor
              value={block.mission}
              onChange={(mission) => onChange({ ...block, mission })}
              errors={errors?.mission}
              max={MISSION_ITEMS_MAX}
              itemMax={300}
              itemName="Misi"
              addLabel="Tambah misi"
            />
          </div>
          <FormField id={sid("motto")} label="Moto" error={message(errors, "motto")}>
            <Input value={block.motto} onChange={(event) => onChange({ ...block, motto: event.target.value })} />
          </FormField>
        </>
      );
      break;
    case "FEATURES":
      fields = (
        <>
          <HeadingFields block={block} onChange={onChange} errors={errors} sid={sid} />
          <div className="space-y-2">
            <p className="text-sm font-medium">Keunggulan</p>
            {message(errors, "items") ? <p className="text-small text-status-error">{message(errors, "items")}</p> : null}
            <ListEditor
              value={block.items}
              onChange={(items) => onChange({ ...block, items })}
              createItem={() => ({ title: "", description: "", icon: null })}
              max={FEATURES_MAX}
              addLabel="Tambah keunggulan"
              itemLabel={(_item, index) => `Keunggulan ${index + 1}`}
              renderItem={({ item, index, update }) => {
                const itemErrors = (errors?.items as Record<number, BlockErrors> | undefined)?.[index];
                return (
                  <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <FormField id={sid(`item-${index}-title`)} label={`Judul ${index + 1}`} required error={message(itemErrors, "title")}>
                      <Input value={item.title} onChange={(event) => update({ ...item, title: event.target.value })} />
                    </FormField>
                    <IconSelect id={sid(`item-${index}-icon`)} value={item.icon} onChange={(icon) => update({ ...item, icon })} />
                    <FormField
                      id={sid(`item-${index}-description`)}
                      label={`Deskripsi ${index + 1}`}
                      className="sm:col-span-2"
                      error={message(itemErrors, "description")}
                    >
                      <Textarea rows={2} value={item.description} onChange={(event) => update({ ...item, description: event.target.value })} />
                    </FormField>
                  </div>
                );
              }}
            />
          </div>
        </>
      );
      break;
    case "LIST":
      fields = (
        <>
          <HeadingFields block={block} onChange={onChange} errors={errors} sid={sid} />
          <div className="space-y-2">
            <Label htmlFor={sid("style")}>Gaya</Label>
            <Select value={block.style} onValueChange={(style) => onChange({ ...block, style: style as "bullet" | "chips" })}>
              <SelectTrigger id={sid("style")} className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bullet">Poin</SelectItem>
                <SelectItem value="chips">Chip</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Item</p>
            {message(errors, "items") ? <p className="text-small text-status-error">{message(errors, "items")}</p> : null}
            <StringListEditor
              value={block.items}
              onChange={(items) => onChange({ ...block, items })}
              errors={errors?.items}
              max={LIST_ITEMS_MAX}
              itemMax={160}
              itemName="Item"
              addLabel="Tambah item"
            />
          </div>
        </>
      );
      break;
    case "SERVICES":
      fields = (
        <>
          <HeadingFields block={block} onChange={onChange} errors={errors} sid={sid} />
          <FormField id={sid("intro")} label="Pengantar" error={message(errors, "intro")}>
            <Textarea rows={2} value={block.intro} onChange={(event) => onChange({ ...block, intro: event.target.value })} />
          </FormField>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Sumber layanan</legend>
            {(
              [
                ["auto", "Otomatis", "Layanan tayang sesuai urutan di modul Layanan."],
                ["manual", "Pilih manual", "Layanan pilihan dengan urutan sendiri."],
              ] as const
            ).map(([mode, label, help]) => (
              <label key={mode} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-checked:border-fg-strong">
                <input
                  type="radio"
                  name={sid("mode")}
                  checked={block.mode === mode}
                  onChange={() => onChange({ ...block, mode })}
                  className="mt-1 accent-[var(--fg-strong)]"
                />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-small text-fg-muted">{help}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {block.mode === "auto" ? (
            <FormField id={sid("limit")} label="Jumlah layanan" description={`1-${SERVICES_LIMIT_MAX}.`} error={message(errors, "limit")}>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={SERVICES_LIMIT_MAX}
                className="w-28"
                value={Number.isFinite(block.limit) ? block.limit : ""}
                onChange={(event) => onChange({ ...block, limit: event.target.valueAsNumber })}
              />
            </FormField>
          ) : (
            <OptionMultiPicker
              resource="services"
              value={block.ids}
              onChange={(ids) => onChange({ ...block, ids })}
              max={SERVICES_LIMIT_MAX}
              noun="layanan"
              error={message(errors, "ids")}
            />
          )}
        </>
      );
      break;
    case "IMAGE":
      fields = (
        <>
          <FormField
            id={sid("image")}
            label="Gambar"
            required
            description="Wajib punya alt text. Tampil grayscale di situs."
            error={message(errors, "image")}
          >
            <MediaPicker
              value={block.image?.mediaId ?? null}
              onChange={(id) => onChange({ ...block, image: id ? { mediaId: id } : null })}
              initialMedia={block.image ? media[block.image.mediaId] : undefined}
              aspect="16/9"
              dialogTitle="Pilih gambar blok"
            />
          </FormField>
          <FormField id={sid("caption")} label="Keterangan" error={message(errors, "caption")}>
            <Input value={block.caption} onChange={(event) => onChange({ ...block, caption: event.target.value })} />
          </FormField>
        </>
      );
      break;
    case "DOWNLOAD":
      fields = (
        <>
          <HeadingFields block={block} onChange={onChange} errors={errors} sid={sid} />
          <FormField id={sid("description")} label="Deskripsi" error={message(errors, "description")}>
            <Textarea rows={2} value={block.description} onChange={(event) => onChange({ ...block, description: event.target.value })} />
          </FormField>
          <FormField id={sid("label")} label="Label tombol" required error={message(errors, "label")}>
            <Input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} />
          </FormField>
          <FormField
            id={sid("file")}
            label="File PDF"
            description="Blok tanpa file tidak tampil di situs."
            error={message(errors, "file")}
          >
            <MediaPicker
              kind="pdf"
              value={block.file?.mediaId ?? null}
              onChange={(id) => onChange({ ...block, file: id ? { mediaId: id } : null })}
              initialMedia={block.file ? media[block.file.mediaId] : undefined}
              aspect="3/1"
              fit="contain"
            />
          </FormField>
        </>
      );
      break;
  }
  return <div className="space-y-5">{fields}</div>;
}

const NO_ICON = "__none";

// Pilihan ikon ringkas untuk item keunggulan (daftar ikon sama dengan kategori).
function IconSelect({ id, value, onChange }: { id: string; value: string | null; onChange: (icon: string | null) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Ikon</Label>
      <Select value={value ?? NO_ICON} onValueChange={(next) => onChange(next === NO_ICON ? null : next)}>
        {/* SelectValue menampilkan isi item terpilih, termasuk ikonnya. */}
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_ICON}>Tanpa ikon</SelectItem>
          {CATEGORY_ICON_NAMES.map((name) => {
            const Icon = CATEGORY_ICONS[name];
            return (
              <SelectItem key={name} value={name}>
                <Icon className="size-4" strokeWidth={1.5} aria-hidden />
                {name}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
