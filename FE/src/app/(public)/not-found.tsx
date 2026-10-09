import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";

export default function PublicNotFound() {
  return (
    <Container className="py-24 md:py-32">
      <Eyebrow>404</Eyebrow>
      <h1 className="mt-4 max-w-[20ch] text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] text-fg-strong md:text-[56px]">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-6 max-w-[65ch] text-body-lg text-fg-muted">
        Alamat yang Anda buka tidak ada atau sudah dipindahkan. Coba cari pelatihan dari katalog.
      </p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/pelatihan" className={buttonVariants({ variant: "primary", size: "lg" })}>
          Lihat katalog pelatihan
        </Link>
        <Link href="/" className={buttonVariants({ variant: "secondary", size: "lg" })}>
          Ke beranda
        </Link>
      </div>
    </Container>
  );
}
