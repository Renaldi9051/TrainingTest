import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { RevealImage } from "@/components/motion/reveal-parts";
import { PageIntro } from "@/components/public/page-intro";
import { PublicImage } from "@/components/public/public-image";
import { Container } from "@/components/ui/container";
import { getPortfolio } from "@/lib/api/public";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Portofolio",
  alternates: { canonical: "/profil/portofolio" },
};

const COVER_SIZES = "(min-width: 1024px) 720px, calc(100vw - 32px)";
const THUMB_SIZES = "(min-width: 1024px) 240px, 33vw";

export default async function PortfolioPage() {
  const items = await getPortfolio();
  return (
    <>
      <PageIntro title="Portofolio" />
      <Container className="pb-20 md:pb-32">
        {items.length === 0 ? (
          <p className="border-t border-border pt-8 text-body text-fg-muted">Dokumentasi kegiatan sedang disiapkan.</p>
        ) : (
          <ul className="border-t border-border">
            {items.map((item, index) => {
              const [cover, ...rest] = item.images;
              const meta = [item.client, item.date ? formatDate(item.date) : null].filter(Boolean);
              return (
                // Tiap kegiatan satu grup reveal (barisnya tinggi): foto wipe + zoom, thumbnail menyusul.
                <Reveal as="li" key={`${item.title}-${index}`} className="grid gap-6 border-b border-border py-10 md:py-14 lg:grid-cols-12">
                  <div className="space-y-3 lg:col-span-4">
                    {meta.length > 0 ? (
                      <p className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">{meta.join(" · ")}</p>
                    ) : null}
                    <h2 className="text-[20px] leading-[1.25] font-medium text-fg-strong md:text-[24px]">{item.title}</h2>
                    {item.description ? <p className="max-w-[48ch] text-body text-fg-muted">{item.description}</p> : null}
                  </div>
                  <div className="space-y-3 lg:col-span-8">
                    {cover ? (
                      <RevealImage className="group relative aspect-[4/3] overflow-hidden bg-bg-muted">
                        {/* Foto grayscale; kembali berwarna saat hover (portofolio, DESIGN 2). */}
                        <PublicImage
                          image={cover}
                          sizes={COVER_SIZES}
                          className="transition-[filter,transform] duration-300 ease-standard motion-safe:group-hover:scale-[1.03] group-hover:grayscale-0"
                        />
                      </RevealImage>
                    ) : (
                      <div className="aspect-[4/3] bg-bg-muted" />
                    )}
                    {rest.length > 0 ? (
                      <ul data-reveal-children="image" className="grid grid-cols-3 gap-3">
                        {rest.map((image) => (
                          <li key={image.url} className="group relative aspect-[4/3] overflow-hidden bg-bg-muted">
                            <PublicImage
                              image={image}
                              sizes={THUMB_SIZES}
                              className="transition-[filter] duration-300 ease-standard group-hover:grayscale-0"
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </Reveal>
              );
            })}
          </ul>
        )}
      </Container>
    </>
  );
}
