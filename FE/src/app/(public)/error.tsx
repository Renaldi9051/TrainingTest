"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="py-24 md:py-32">
      <Eyebrow>Terjadi kesalahan</Eyebrow>
      <h1 className="mt-4 max-w-[20ch] text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
        Halaman tidak dapat dimuat
      </h1>
      <p className="mt-6 max-w-[65ch] text-body-lg text-fg-muted">
        Server sedang sibuk atau tidak dapat dihubungi. Coba lagi beberapa saat lagi.
      </p>
      <div className="mt-10">
        <Button size="lg" onClick={reset}>
          Coba lagi
        </Button>
      </div>
    </Container>
  );
}
