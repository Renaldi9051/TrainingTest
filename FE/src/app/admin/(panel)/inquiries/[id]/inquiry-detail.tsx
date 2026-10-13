"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileXIcon, MailIcon, MessageCircleIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/admin/ui/button";
import { Label } from "@/components/admin/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/admin/ui/select";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { Textarea } from "@/components/admin/ui/textarea";
import { useDeleteWithUndo } from "@/hooks/use-delete-with-undo";
import { useScopedId } from "@/hooks/use-scoped-id";
import { ApiError, apiFetch, apiSend, errorMessage } from "@/lib/api/client";
import type { Inquiry, InquiryStatus } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";
import { INQUIRY_SOURCE_LABELS, INQUIRY_STATUS_LABELS } from "@/lib/labels";
import { dashboardKey } from "../../dashboard";
import { inquiryKeys, InquiryStatusLabel } from "../inquiry-status";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-border py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-small text-fg-muted">{label}</dt>
      <dd className="text-sm break-words text-fg-strong">{children}</dd>
    </div>
  );
}

const dash = <span className="text-fg-muted">-</span>;

export function InquiryDetail({ id }: { id: string }) {
  const sid = useScopedId("inquiry");
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: inquiryKeys.detail(id),
    queryFn: async () => (await apiFetch<Inquiry>(`/admin/inquiries/${id}`)).data,
  });
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: inquiryKeys.all });
    await queryClient.invalidateQueries({ queryKey: dashboardKey });
  };
  const update = useMutation({
    mutationFn: async (body: { status?: InquiryStatus; note?: string }) =>
      (await apiSend<Inquiry>(`/admin/inquiries/${id}`, "PATCH", body)).data,
    onSuccess: async (data, body) => {
      queryClient.setQueryData(inquiryKeys.detail(id), data);
      await invalidate();
      if (body.note !== undefined) setNote(null);
      toast.success(body.status ? `Status diubah ke ${INQUIRY_STATUS_LABELS[body.status]}.` : "Catatan disimpan.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useDeleteWithUndo({
    basePath: "/admin/inquiries",
    invalidateKey: inquiryKeys.all,
    noun: "Inquiry",
    onDeleted: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKey });
      router.push("/admin/inquiries");
    },
  });

  if (query.isPending) {
    return (
      <div className="space-y-4" role="status" aria-label="Memuat inquiry">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-60 w-full max-w-3xl" />
      </div>
    );
  }
  if (query.isError) {
    const notFound = query.error instanceof ApiError && (query.error.status === 404 || query.error.status === 422);
    return (
      <EmptyState
        icon={FileXIcon}
        title={notFound ? "Inquiry tidak ditemukan" : "Inquiry tidak dapat dimuat"}
        description={notFound ? "Inquiry mungkin sudah dihapus." : "Periksa koneksi lalu coba lagi."}
        action={
          notFound ? (
            <Button variant="outline" asChild>
              <Link href="/admin/inquiries">Kembali ke daftar</Link>
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void query.refetch()}>
              Coba lagi
            </Button>
          )
        }
      />
    );
  }

  const inquiry = query.data;
  const noteValue = note ?? inquiry.note ?? "";
  const subject = `Re: ${inquiry.training?.title ?? "permintaan pelatihan"}`;

  return (
    <>
      <PageHeader
        title={inquiry.name}
        description={`Masuk ${formatDateTime(inquiry.createdAt)} · ${INQUIRY_SOURCE_LABELS[inquiry.source]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {inquiry.phone ? (
              <Button variant="outline" asChild>
                <a href={`https://wa.me/${inquiry.phone}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon aria-hidden />
                  WhatsApp
                  <span className="sr-only"> (tab baru)</span>
                </a>
              </Button>
            ) : null}
            <Button variant="outline" asChild>
              <a href={`mailto:${inquiry.email}?subject=${encodeURIComponent(subject)}`}>
                <MailIcon aria-hidden />
                Email
              </a>
            </Button>
            <Button variant="outline" className="text-status-error" onClick={() => setConfirmDelete(true)}>
              <Trash2Icon aria-hidden />
              Hapus
            </Button>
          </div>
        }
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <dl className="border-t border-border">
          <Field label="Nama">{inquiry.name}</Field>
          <Field label="Instansi">{inquiry.company ?? dash}</Field>
          <Field label="Email">{inquiry.email}</Field>
          <Field label="WhatsApp">{inquiry.phone ? `+${inquiry.phone}` : dash}</Field>
          <Field label="Pelatihan">
            {inquiry.training ? (
              <Link href={`/admin/trainings/${inquiry.training.id}`} className="underline-offset-4 hover:underline">
                {inquiry.training.title}
              </Link>
            ) : (
              (inquiry.interest ?? dash)
            )}
          </Field>
          <Field label="Pesan">{inquiry.message ? <span className="whitespace-pre-line">{inquiry.message}</span> : dash}</Field>
          <Field label="Persetujuan data">
            {inquiry.consentAt ? `${formatDateTime(inquiry.consentAt)} (versi teks ${inquiry.consentVersion ?? "-"})` : dash}
          </Field>
        </dl>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor={sid("status")}>Status</Label>
            <Select
              value={inquiry.status}
              onValueChange={(value) => update.mutate({ status: value as InquiryStatus })}
              disabled={update.isPending}
            >
              <SelectTrigger id={sid("status")} className="w-full">
                <SelectValue>
                  <InquiryStatusLabel status={inquiry.status} />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatus[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {INQUIRY_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <form
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate({ note: noteValue });
            }}
          >
            <Label htmlFor={sid("note")}>Catatan internal</Label>
            <Textarea
              id={sid("note")}
              value={noteValue}
              onChange={(event) => setNote(event.target.value)}
              rows={6}
              maxLength={2000}
              aria-describedby={sid("note-hint")}
            />
            <p id={sid("note-hint")} className="text-small text-fg-muted">
              Hanya terlihat oleh admin.
            </p>
            <Button type="submit" disabled={update.isPending || note === null}>
              Simpan catatan
            </Button>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Hapus inquiry ini?"
        description="Inquiry dipindahkan ke Sampah dan dihapus permanen setelah 30 hari."
        confirmLabel="Hapus"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate({ id, label: inquiry.name }, { onSettled: () => setConfirmDelete(false) })}
      />
    </>
  );
}
