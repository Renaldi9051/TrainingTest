import { PlusMarker } from "@/components/decor/plus-marker";
import { Reveal } from "@/components/motion/reveal";
import { LineDraw } from "@/components/motion/reveal-parts";
import { CopyButton } from "@/components/public/copy-button";
import { CtaLink } from "@/components/public/cta-link";
import { PublicImage } from "@/components/public/public-image";
import type { PaymentAccount, PublicImage as PublicImageData } from "@/lib/api/types";

// Rekening tujuan transfer (blok PAYMENT_ACCOUNTS). Baris dipisah garis (bukan kartu), nomor mono besar
// supaya mudah dibaca & dicocokkan, tombol Salin menyalin angkanya saja (tanpa spasi/strip). Logo bank
// dekoratif: nama bank selalu tampil sebagai teks.
export function PaymentAccounts({
  anchor,
  accounts,
  confirm,
}: {
  anchor: string;
  accounts: PaymentAccount<PublicImageData>[];
  confirm: { label: string; href: string } | null;
}) {
  return (
    <div className="space-y-8">
      <Reveal className="relative">
        <PlusMarker className="-top-1.5 -left-1.5" />
        <LineDraw />
        <ul data-reveal-children="item">
          {accounts.map((account, index) => {
            const numberId = `${anchor}-nomor-${index + 1}`;
            return (
              <li key={numberId} className="grid gap-5 border-b border-border py-6 md:grid-cols-12 md:items-center md:gap-6">
                <div className="flex min-w-0 items-center gap-4 md:col-span-5">
                  {account.logo ? (
                    <span className="relative h-10 w-16 shrink-0">
                      <PublicImage image={{ ...account.logo, alt: "" }} sizes="64px" fit="contain" className="bg-transparent" />
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <h3 className="text-[20px] leading-[1.25] font-medium text-fg-strong md:text-[24px]">{account.bank}</h3>
                    {account.note ? <p className="mt-1 text-small text-fg-muted">{account.note}</p> : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-4 md:col-span-7">
                  <dl className="min-w-0 space-y-3">
                    <div>
                      <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Nomor rekening</dt>
                      <dd
                        id={numberId}
                        className="mt-1 font-mono text-[24px] leading-[1.2] font-medium tracking-[0.02em] break-all text-fg-strong tabular-nums md:text-[28px]"
                      >
                        {account.number}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Atas nama</dt>
                      <dd className="mt-1 text-body text-fg">{account.holder}</dd>
                    </div>
                  </dl>
                  <CopyButton
                    value={account.number.replace(/\D/g, "")}
                    targetId={numberId}
                    label={`nomor rekening ${account.bank}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Reveal>
      {confirm ? <CtaLink cta={confirm} variant="primary" arrow /> : null}
    </div>
  );
}
