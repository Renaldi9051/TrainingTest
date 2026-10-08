import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDevelopment } from "@/lib/env";
import { PageHeader } from "@/components/admin/page-header";
import { TableSkeleton } from "@/components/admin/table-skeleton";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminComponentsPreview } from "./admin-components-preview";

export const metadata: Metadata = { title: "Komponen UI" };

// Hanya untuk development: katalog komponen dasar publik & admin.
export default function UiPreviewPage() {
  if (!isDevelopment) notFound();

  return (
    <>
      <PageHeader
        title="Komponen UI"
        description="Pratinjau komponen dasar. Halaman ini hanya aktif saat development."
      />

      <Section title="Publik: tombol">
        {(["primary", "secondary", "ghost"] as const).map((variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-4">
            <span className="w-24 font-mono text-label uppercase text-fg-muted">{variant}</span>
            <Button variant={variant} size="sm">
              Kecil
            </Button>
            <Button variant={variant}>Sedang</Button>
            <Button variant={variant} size="lg" arrow>
              Lihat pelatihan
            </Button>
            <Button variant={variant} disabled>
              Nonaktif
            </Button>
          </div>
        ))}
      </Section>

      <Section title="Publik: form">
        <div className="grid max-w-xl gap-5">
          <div className="space-y-2">
            <Label htmlFor="preview-name">Nama lengkap</Label>
            <Input id="preview-name" placeholder="Contoh: Budi Santoso" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-disabled">Nonaktif</Label>
            <Input id="preview-disabled" disabled defaultValue="Tidak bisa diubah" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-message">Pesan</Label>
            <Textarea id="preview-message" placeholder="Tulis kebutuhan pelatihan Anda" />
          </div>
        </div>
      </Section>

      <Section title="Publik: tipografi & container">
        <Container className="border border-dashed border-border-strong py-8">
          <Eyebrow index="01">Layanan</Eyebrow>
          <h2 className="mt-4 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg-strong md:text-[40px]">
            Judul section h2
          </h2>
          <p className="mt-4 max-w-[65ch] text-body-lg text-fg-muted">
            Paragraf lead. Container maksimal 1280 px dengan padding samping 16 px di mobile dan 24 px
            di desktop.
          </p>
        </Container>
      </Section>

      <Section title="Admin">
        <AdminComponentsPreview />
      </Section>

      <Section title="Admin: skeleton tabel">
        <TableSkeleton rows={3} />
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="mb-6 font-mono text-label font-medium uppercase text-fg-muted">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
