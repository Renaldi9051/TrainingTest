"use client";

import { CheckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiFetch } from "@/lib/api/client";
import type { InquiryInput, InquirySource } from "@/lib/api/types";
import { type InquirySession, messageWithSession } from "@/lib/inquiry-session";

// Teks persetujuan pemrosesan data (UU PDP). Kalau diubah, naikkan CONSENT_VERSION di
// BE/src/lib/validators/inquiry.ts supaya tercatat teks versi mana yang disetujui.
export function consentText(siteName: string): string {
  return `Saya setuju ${siteName} memproses data di atas untuk menindaklanjuti permintaan ini.`;
}

type Field = "name" | "company" | "email" | "phone" | "interest" | "message" | "consent";
const FIELD_ORDER: Field[] = ["name", "company", "email", "phone", "interest", "message", "consent"];

export type InquiryTraining = { slug: string; title: string };


// Form inquiry publik (detail pelatihan & /kontak). Validasi utama di BE (Zod); di sini hanya atribut
// HTML. Error per field dari BE ditampilkan di bawah field-nya, fokus pindah ke field pertama yang
// salah. Honeypot "website" tersembunyi dari manusia dan pembaca layar.
export function InquiryForm({
  siteName,
  privacyHref,
  source,
  training: initialTraining,
  sessions = [],
  onSent,
}: {
  siteName: string;
  // null kalau halaman Kebijakan Privasi tidak ada: teks persetujuan tanpa link.
  privacyHref: string | null;
  source: InquirySource;
  training: InquiryTraining | null;
  sessions?: InquirySession[];
  onSent?: () => void;
}) {
  const id = useId();
  const fieldId = (field: string) => `${id}-${field}`;
  const [training, setTraining] = useState(initialTraining);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "");
    const body: InquiryInput = {
      name: text("name"),
      company: text("company"),
      email: text("email"),
      phone: text("phone"),
      trainingSlug: training?.slug ?? null,
      interest: training ? "" : text("interest"),
      message: messageWithSession(
        text("message"),
        training ? sessions.find((session) => session.id === text("session")) : undefined,
      ),
      source,
      consent: data.get("consent") === "on",
      website: text("website"),
    };
    setPending(true);
    setFormError(null);
    try {
      await apiFetch("/public/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setErrors({});
      setSent(true);
      onSent?.();
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        const next: Partial<Record<Field, string>> = {};
        for (const [key, messages] of Object.entries(error.fields)) {
          if ((FIELD_ORDER as string[]).includes(key)) next[key as Field] = messages[0];
        }
        setErrors(next);
        const first = FIELD_ORDER.find((field) => next[field]);
        if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
        else setFormError(error.message);
      } else {
        setFormError(error instanceof ApiError ? error.message : "Pesan gagal dikirim. Periksa koneksi lalu coba lagi.");
      }
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="border border-fg-strong bg-bg p-6 md:p-10">
        <div role="status" className="space-y-3">
          <p className="font-mono text-label font-medium uppercase tracking-[0.08em] text-fg-strong">Terkirim</p>
          <p className="flex items-center gap-2 text-h3 text-fg-strong">
            <CheckIcon aria-hidden strokeWidth={1.5} className="size-5 shrink-0" />
            Terima kasih, pesan terkirim.
          </p>
          <p className="text-body text-fg-muted">Tim kami akan menghubungi Anda lewat email atau WhatsApp.</p>
        </div>
        <Button type="button" variant="secondary" className="mt-6" onClick={() => setSent(false)}>
          Kirim pesan lain
        </Button>
      </div>
    );
  }

  const describedBy = (field: Field, hint?: string) => [hint, errors[field] ? fieldId(`${field}-error`) : null].filter(Boolean).join(" ") || undefined;
  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={fieldId(`${field}-error`)} className="text-small text-fg-strong">
        {errors[field]}
      </p>
    ) : null;
  const textField = (field: Field, label: string, props: Record<string, unknown>, hint?: string) => (
    <div className="space-y-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <Input
        id={fieldId(field)}
        name={field}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={describedBy(field, hint ? fieldId(`${field}-hint`) : undefined)}
        {...props}
      />
      {hint ? (
        <p id={fieldId(`${field}-hint`)} className="text-small text-fg-muted">
          {hint}
        </p>
      ) : null}
      {fieldError(field)}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-6" aria-describedby={formError ? fieldId("form-error") : undefined}>
      {training ? (
        <div className="flex items-start justify-between gap-4 border-y border-border py-4">
          <div>
            <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Pelatihan</p>
            <p className="mt-1 text-body font-medium text-fg-strong">{training.title}</p>
          </div>
          <button
            type="button"
            onClick={() => setTraining(null)}
            className="inline-flex size-8 items-center justify-center rounded-sm text-fg-muted outline-none hover:text-fg-strong focus-visible:ring-2 focus-visible:ring-fg-strong"
            aria-label={`Lepas pelatihan ${training.title}`}
          >
            <XIcon aria-hidden strokeWidth={1.5} className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        {textField("name", "Nama lengkap", { required: true, minLength: 2, maxLength: 100, autoComplete: "name" })}
        {textField("company", "Instansi (opsional)", { maxLength: 150, autoComplete: "organization" })}
        {textField("email", "Email", { type: "email", required: true, maxLength: 254, autoComplete: "email" })}
        {textField(
          "phone",
          "Nomor WhatsApp (opsional)",
          { type: "tel", maxLength: 30, autoComplete: "tel", inputMode: "tel" },
          "Contoh: 0812 3456 7890",
        )}
      </div>
      {training ? null : textField("interest", "Pelatihan yang diminati (opsional)", { maxLength: 200 })}
      {training && sessions.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor={fieldId("session")}>Sesi (opsional)</Label>
          <Select id={fieldId("session")} name="session" defaultValue="">
            <option value="">Belum menentukan</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={fieldId("message")}>Pesan (opsional)</Label>
        <Textarea
          id={fieldId("message")}
          name="message"
          rows={4}
          maxLength={2000}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy("message")}
        />
        {fieldError("message")}
      </div>

      {/* Honeypot: tersembunyi dari manusia & pembaca layar, diisi bot. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={fieldId("website")}>Website</label>
        <input id={fieldId("website")} name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-small text-fg">
          <input
            type="checkbox"
            name="consent"
            required
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={describedBy("consent")}
            className="mt-0.5 size-4 shrink-0 accent-[var(--fg-strong)]"
          />
          <span>
            {consentText(siteName)}{" "}
            {privacyHref ? (
              <>
                Selengkapnya di{" "}
                <Link href={privacyHref} className="underline underline-offset-4 hover:text-fg-strong">
                  Kebijakan Privasi
                </Link>
                .
              </>
            ) : null}
          </span>
        </label>
        {fieldError("consent")}
      </div>

      {formError ? (
        <p id={fieldId("form-error")} role="alert" className="text-small text-fg-strong">
          {formError}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} arrow={!pending}>
        {pending ? "Mengirim..." : "Kirim pesan"}
      </Button>
    </form>
  );
}
