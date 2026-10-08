import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  // Aksi di kanan, mis. tombol "Tambah".
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-fg-strong">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-[65ch] text-small text-fg-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
