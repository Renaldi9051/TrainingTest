"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRightIcon, CalendarPlusIcon, FilePlusIcon, LayoutTemplateIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/admin/ui/button";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { ATTENTION_META, activityHref, activityText, relativeTime } from "@/lib/admin-issues";
import { apiFetch } from "@/lib/api/client";
import type { Dashboard as DashboardData } from "@/lib/api/types";

const numberFormat = new Intl.NumberFormat("id-ID");
const absolute = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

export const dashboardKey = ["admin", "dashboard"] as const;

const SHORTCUTS = [
  { href: "/admin/trainings/new", label: "Tambah pelatihan", icon: FilePlusIcon },
  { href: "/admin/schedules?baru=1", label: "Tambah jadwal", icon: CalendarPlusIcon },
  { href: "/admin/home", label: "Edit beranda", icon: LayoutTemplateIcon },
  { href: "/admin/settings", label: "Pengaturan situs", icon: SettingsIcon },
] as const;

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-fg-strong">{title}</h2>
        {description ? <p className="text-small text-fg-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, note, href }: { label: string; value: ReactNode; note?: string; href?: string }) {
  const body = (
    <>
      <dt className="font-mono text-label font-medium uppercase text-fg-muted">{label}</dt>
      <dd className="mt-3 font-mono text-3xl font-medium tracking-tight text-fg-strong tabular-nums">{value}</dd>
      {note ? <dd className="mt-1 text-small text-fg-muted">{note}</dd> : null}
    </>
  );
  return (
    <div className="border-r border-b border-border p-5">
      {href ? (
        <Link href={href} className="block rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-fg-strong">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

function StatsGrid({ data }: { data: DashboardData | undefined }) {
  const value = (number: number | undefined) =>
    number === undefined ? <Skeleton className="h-9 w-16" aria-label="Memuat" /> : numberFormat.format(number);
  const counts = data?.counts;
  return (
    <dl className="grid grid-cols-2 border-t border-l border-border lg:grid-cols-4">
      <Stat
        label="Pelatihan tayang"
        value={value(counts?.trainings.published)}
        note={counts ? `${numberFormat.format(counts.trainings.scheduled)} terjadwal · ${numberFormat.format(counts.trainings.draft)} draf` : undefined}
        href="/admin/trainings?status=PUBLISHED"
      />
      <Stat label="Kategori" value={value(counts?.categories)} href="/admin/categories" />
      <Stat
        label="Jadwal bulan ini"
        value={value(counts?.schedules.thisMonth)}
        note={counts ? `${numberFormat.format(counts.schedules.next30Days)} dalam 30 hari ke depan` : undefined}
        href="/admin/schedules"
      />
      <Stat
        label="Sesi penuh"
        value={value(counts?.schedules.fullUpcoming)}
        note={
          counts
            ? `${numberFormat.format(counts.publicWithoutUpcoming)} pelatihan public tanpa jadwal mendatang`
            : undefined
        }
        href="/admin/schedules?period=upcoming&status=FULL"
      />
    </dl>
  );
}

// Slot modul yang belum ada: tanpa angka palsu.
function PendingModules() {
  return (
    <dl className="grid grid-cols-1 border-t border-l border-border sm:grid-cols-2">
      {[
        ["Inquiry baru", "Aktif setelah modul Inquiry dibuat."],
        ["Evaluasi baru", "Aktif setelah modul Evaluasi dibuat."],
      ].map(([label, note]) => (
        <div key={label} className="border-r border-b border-border p-5">
          <dt className="font-mono text-label font-medium uppercase text-fg-muted">{label}</dt>
          <dd className="mt-3 text-small text-fg-muted">{note}</dd>
        </div>
      ))}
    </dl>
  );
}

function Attention({ data }: { data: DashboardData }) {
  const groups = data.attention.filter((group) => group.count > 0);
  if (groups.length === 0) {
    return <p className="rounded-md border border-border px-4 py-6 text-small text-fg-muted">Semua beres. Tidak ada yang perlu dirapikan.</p>;
  }
  return (
    <ul className="divide-y divide-border border-y border-border">
      {groups.map((group) => {
        const meta = ATTENTION_META[group.key];
        return (
          <li key={group.key} className="space-y-2 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-fg-strong">
                <span aria-hidden className="size-1.5 rounded-full bg-status-warning" />
                {meta.label}
                <span className="font-mono text-xs text-fg-muted tabular-nums">{numberFormat.format(group.count)}</span>
              </p>
              <Link href={meta.all} className="inline-flex items-center gap-1 text-small underline-offset-4 hover:underline">
                Lihat semua
                <span className="sr-only">: {meta.label}</span>
                <ArrowRightIcon className="size-3.5" aria-hidden />
              </Link>
            </div>
            <p className="text-small text-fg-muted">{meta.hint}</p>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <Link href={meta.item(item.id)} className="text-small underline-offset-4 hover:underline">
                    {item.title}
                  </Link>
                  {item.detail ? <span className="ml-2 font-mono text-xs text-fg-muted">{item.detail}</span> : null}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function Activity({ data }: { data: DashboardData }) {
  if (data.activity.length === 0) {
    return <p className="rounded-md border border-border px-4 py-6 text-small text-fg-muted">Belum ada aktivitas.</p>;
  }
  return (
    <ol className="divide-y divide-border border-y border-border">
      {data.activity.map((item) => {
        const href = item.linkable && item.entityId ? activityHref(item.entity, item.entityId) : null;
        const text = activityText(item.action, item.entity);
        return (
          <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-small">
            <span>
              <span className="font-medium text-fg-strong">{item.userName ?? "Sistem"}</span>{" "}
              {href ? (
                <Link href={href} className="underline-offset-4 hover:underline">
                  {text}
                </Link>
              ) : (
                <span>{text}</span>
              )}
            </span>
            <time dateTime={item.createdAt} title={absolute.format(new Date(item.createdAt))} className="font-mono text-xs text-fg-muted">
              {relativeTime(item.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-5 w-full" />
      ))}
    </div>
  );
}

export function Dashboard() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: dashboardKey,
    queryFn: async () => (await apiFetch<DashboardData>("/admin/dashboard")).data,
  });

  return (
    <div className="space-y-10">
      <nav aria-label="Pintasan" className="flex flex-wrap gap-2">
        {SHORTCUTS.map(({ href, label, icon: Icon }) => (
          <Button key={href} variant="outline" size="sm" asChild>
            <Link href={href}>
              <Icon aria-hidden />
              {label}
            </Link>
          </Button>
        ))}
      </nav>

      {isError ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-4 py-3">
          <p className="text-small text-status-error">Ringkasan tidak dapat dimuat.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Coba lagi
          </Button>
        </div>
      ) : (
        <>
          <StatsGrid data={data} />
          <PendingModules />
          <div className="grid gap-10 lg:grid-cols-2">
            <Panel title="Perlu dibereskan" description="Lima item pertama per jenis; buka daftar lengkap dengan Lihat semua.">
              {isPending ? <ListSkeleton /> : <Attention data={data} />}
            </Panel>
            <Panel title="Aktivitas terakhir" description="Sepuluh perubahan terbaru dari log audit.">
              {isPending ? <ListSkeleton /> : <Activity data={data} />}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
