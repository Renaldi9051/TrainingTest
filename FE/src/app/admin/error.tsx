"use client";

import { Button } from "@/components/admin/ui/button";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 px-6">
      <p className="font-mono text-label font-medium uppercase text-fg-muted">Terjadi kesalahan</p>
      <h1 className="text-2xl font-semibold tracking-tight text-fg-strong">
        Halaman admin tidak dapat dimuat
      </h1>
      <p className="text-small text-fg-muted">
        Server sedang tidak dapat dihubungi atau terjadi kesalahan. Coba muat ulang beberapa saat lagi.
      </p>
      <div>
        <Button onClick={reset}>Coba lagi</Button>
      </div>
    </main>
  );
}
