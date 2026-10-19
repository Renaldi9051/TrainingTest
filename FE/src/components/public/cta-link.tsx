import Link from "next/link";
import { ButtonContent, buttonVariants, MAGNETIC } from "@/components/ui/button";
import type { Cta } from "@/lib/api/types";

// Tombol CTA dari CMS (DESIGN.md 8.2): magnetic + teks roll. https:// dibuka di tab baru.
export function CtaLink({ cta, variant, arrow }: { cta: Cta; variant: "primary" | "secondary" | "inverse" | "inverseOutline"; arrow?: boolean }) {
  const external = /^https:\/\//i.test(cta.href);
  const className = buttonVariants({ variant, size: "lg" });
  const content = (
    <ButtonContent arrow={arrow} roll>
      {cta.label}
    </ButtonContent>
  );
  return external ? (
    <a href={cta.href} target="_blank" rel="noopener noreferrer" className={className} {...MAGNETIC}>
      {content}
      <span className="sr-only"> (tab baru)</span>
    </a>
  ) : (
    <Link href={cta.href} className={className} {...MAGNETIC}>
      {content}
    </Link>
  );
}
