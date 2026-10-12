import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

// Kepala halaman publik: eyebrow mono, satu h1 (56/36 px), lead paragraph. Langsung terbaca
// tanpa reveal (konten layar pertama).
export function PageIntro({ eyebrow, title, lead, children }: { eyebrow?: string; title: string; lead?: string | null; children?: ReactNode }) {
  return (
    <Container className="space-y-6 pt-16 pb-12 md:pt-24 md:pb-16">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h1 className="max-w-[20ch] text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
        {title}
      </h1>
      {lead ? <p className="max-w-[65ch] text-body-lg text-fg-muted">{lead}</p> : null}
      {children}
    </Container>
  );
}
