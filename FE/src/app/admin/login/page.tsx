import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/admin/ui/skeleton";
import { getCurrentAdmin } from "@/lib/api/server";
import { safeAdminPath } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="font-mono text-label font-medium uppercase text-fg-muted">Panel admin</p>
        <h1 className="mt-3 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg-strong">
          Masuk
        </h1>
        <p className="mt-2 text-small text-fg-muted">Gunakan email dan kata sandi akun admin.</p>
        <div className="mt-8">
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginGate searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

// Sudah login (sesi valid di BE) = langsung ke admin. Cookie basi tetap menampilkan form,
// jadi tidak ada loop redirect antara /admin dan /admin/login.
async function LoginGate({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const { next } = await searchParams;
  const nextPath = safeAdminPath(typeof next === "string" ? next : null);
  if (await getCurrentAdmin()) redirect(nextPath);
  return <LoginForm next={nextPath} />;
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
