"use client";

import { useId } from "react";
import { CountedInput, ListEditor } from "@/components/admin/list-editor";
import { Input } from "@/components/admin/ui/input";
import { Label } from "@/components/admin/ui/label";
import { Textarea } from "@/components/admin/ui/textarea";
import type { AudienceItem, FaqItem, TrainingModule } from "@/lib/api/types";
import {
  AUDIENCE_MAX,
  AUDIENCE_NOTE_MAX,
  AUDIENCE_ROLE_MAX,
  FAQ_A_MAX,
  FAQ_MAX,
  FAQ_Q_MAX,
  MODULE_POINT_MAX,
  MODULE_POINTS_MAX,
  MODULE_TITLE_MAX,
  MODULES_MAX,
} from "@/lib/training-content";
import { cn } from "@/lib/utils";

// Error per item dari React Hook Form, mis. errors.outcomes?.[2]?.message.
export type ItemErrors = ({ message?: string } | undefined)[] | undefined;

type ListProps<T> = { value: T[]; onChange: (value: T[]) => void; errors?: unknown };

// Error RHF untuk array bisa berbentuk objek ber-index; ambil pesan item ke-i dengan aman.
function itemError(errors: unknown, index: number, key?: string): string | undefined {
  if (!errors || typeof errors !== "object") return undefined;
  const entry = (errors as Record<number, unknown>)[index];
  if (!entry || typeof entry !== "object") return undefined;
  const target = key ? (entry as Record<string, unknown>)[key] : entry;
  return target && typeof target === "object" && "message" in target ? String(target.message) : undefined;
}

export function StringListEditor({
  value,
  onChange,
  errors,
  max,
  itemMax,
  itemName,
  addLabel,
  placeholder,
  emptyText,
}: ListProps<string> & {
  max: number;
  itemMax: number;
  // Nama item untuk label, mis. "Hasil belajar".
  itemName: string;
  addLabel: string;
  placeholder?: string;
  emptyText?: string;
}) {
  const baseId = useId();
  return (
    <ListEditor
      value={value}
      onChange={onChange}
      createItem={() => ""}
      max={max}
      addLabel={addLabel}
      emptyText={emptyText}
      itemLabel={(_item, index) => `${itemName} ${index + 1}`}
      renderItem={({ item, index, update }) => (
        <CountedInput
          id={`${baseId}-${index}`}
          label={`${itemName} ${index + 1}`}
          value={item}
          onChange={update}
          max={itemMax}
          placeholder={placeholder}
          error={itemError(errors, index)}
        />
      )}
    />
  );
}

export function ModulesEditor({ value, onChange, errors }: ListProps<TrainingModule>) {
  const baseId = useId();
  return (
    <ListEditor
      value={value}
      onChange={onChange}
      createItem={() => ({ title: "", points: [], durationMinutes: null })}
      max={MODULES_MAX}
      addLabel="Tambah modul"
      emptyText="Belum ada modul materi."
      itemLabel={(item, index) => `Modul ${index + 1}${item.title ? `: ${item.title}` : ""}`}
      renderItem={({ item, index, update }) => {
        const id = `${baseId}-${index}`;
        const durationError = itemError(errors, index, "durationMinutes");
        return (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1">
                <Label htmlFor={`${id}-title`} className="text-xs text-fg-muted">
                  Judul modul {index + 1}
                </Label>
                <CountedInput
                  id={`${id}-title`}
                  label={`Judul modul ${index + 1}`}
                  value={item.title}
                  onChange={(title) => update({ ...item, title })}
                  max={MODULE_TITLE_MAX}
                  error={itemError(errors, index, "title")}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-duration`} className="text-xs text-fg-muted">
                  Durasi (menit)
                </Label>
                <Input
                  id={`${id}-duration`}
                  inputMode="numeric"
                  value={item.durationMinutes ?? ""}
                  placeholder="Opsional"
                  aria-invalid={durationError ? true : undefined}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "");
                    update({ ...item, durationMinutes: digits ? Number(digits) : null });
                  }}
                />
                {durationError ? <p className="text-small text-status-error">{durationError}</p> : null}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-fg-muted">Poin materi</p>
              <StringListEditor
                value={item.points}
                onChange={(points) => update({ ...item, points })}
                errors={
                  errors && typeof errors === "object"
                    ? ((errors as Record<number, { points?: unknown } | undefined>)[index]?.points ?? undefined)
                    : undefined
                }
                max={MODULE_POINTS_MAX}
                itemMax={MODULE_POINT_MAX}
                itemName={`Poin modul ${index + 1}`}
                addLabel="Tambah poin"
              />
            </div>
          </div>
        );
      }}
    />
  );
}

export function AudienceEditor({ value, onChange, errors }: ListProps<AudienceItem>) {
  const baseId = useId();
  return (
    <ListEditor
      value={value}
      onChange={onChange}
      createItem={() => ({ role: "", note: null })}
      max={AUDIENCE_MAX}
      addLabel="Tambah peserta"
      emptyText="Belum ada target peserta."
      itemLabel={(item, index) => `Peserta ${index + 1}${item.role ? `: ${item.role}` : ""}`}
      renderItem={({ item, index, update }) => (
        <div className="grid gap-2 sm:grid-cols-2">
          <CountedInput
            id={`${baseId}-${index}-role`}
            label={`Peran peserta ${index + 1}`}
            value={item.role}
            onChange={(role) => update({ ...item, role })}
            max={AUDIENCE_ROLE_MAX}
            placeholder="Peran, mis. Supervisor"
            error={itemError(errors, index, "role")}
          />
          <CountedInput
            id={`${baseId}-${index}-note`}
            label={`Catatan peserta ${index + 1}`}
            value={item.note ?? ""}
            onChange={(note) => update({ ...item, note: note || null })}
            max={AUDIENCE_NOTE_MAX}
            placeholder="Catatan (opsional)"
            error={itemError(errors, index, "note")}
          />
        </div>
      )}
    />
  );
}

export function FaqEditor({ value, onChange, errors, emptyText }: ListProps<FaqItem> & { emptyText?: string }) {
  const baseId = useId();
  return (
    <ListEditor
      value={value}
      onChange={onChange}
      createItem={() => ({ q: "", a: "" })}
      max={FAQ_MAX}
      addLabel="Tambah pertanyaan"
      emptyText={emptyText ?? "Belum ada FAQ."}
      itemLabel={(item, index) => `FAQ ${index + 1}${item.q ? `: ${item.q}` : ""}`}
      renderItem={({ item, index, update }) => {
        const answerId = `${baseId}-${index}-a`;
        const answerError = itemError(errors, index, "a");
        return (
          <div className="space-y-2">
            <CountedInput
              id={`${baseId}-${index}-q`}
              label={`Pertanyaan ${index + 1}`}
              value={item.q}
              onChange={(q) => update({ ...item, q })}
              max={FAQ_Q_MAX}
              placeholder="Pertanyaan"
              error={itemError(errors, index, "q")}
            />
            <label htmlFor={answerId} className="sr-only">
              Jawaban {index + 1}
            </label>
            <Textarea
              id={answerId}
              rows={2}
              value={item.a}
              placeholder="Jawaban"
              aria-invalid={answerError ? true : undefined}
              onChange={(event) => update({ ...item, a: event.target.value })}
            />
            <div className="flex justify-between">
              {answerError ? <p className="text-small text-status-error">{answerError}</p> : <span />}
              <span className={cn("font-mono text-xs", item.a.length > FAQ_A_MAX ? "text-status-error" : "text-fg-muted")}>
                {item.a.length}/{FAQ_A_MAX}
              </span>
            </div>
          </div>
        );
      }}
    />
  );
}
