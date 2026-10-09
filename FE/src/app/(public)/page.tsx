import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

// Beranda lengkap (section dari CMS) dibuat di Fase 3. Sementara hanya pintu masuk ke katalog.
export default function HomePage() {
  return (
    <Container className="py-20 md:py-32">
      <Eyebrow>Beranda</Eyebrow>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/pelatihan" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Lihat pelatihan
        </Link>
        <Link href="/jadwal" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Lihat jadwal
        </Link>
      </div>
    </Container>
  );
}
