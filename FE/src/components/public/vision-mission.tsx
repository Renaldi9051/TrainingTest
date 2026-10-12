// Visi & misi dua kolom (beranda dan blok halaman profil). Judul kolom h3 di bawah h2 section.
export function VisionMission({ vision, mission, motto }: { vision: string; mission: string[]; motto: string }) {
  return (
    <div className="grid gap-12 border-t border-border pt-10 md:grid-cols-2 md:gap-6">
      <div className="space-y-4">
        <h3 className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Visi</h3>
        <p className="max-w-[40ch] text-[20px] leading-[1.4] font-medium text-fg-strong md:text-[24px]">{vision}</p>
        {motto ? <p className="text-body text-fg-muted">{motto}</p> : null}
      </div>
      <div className="space-y-4">
        <h3 className="font-mono text-label uppercase tracking-[0.08em] text-fg-muted">Misi</h3>
        <ol className="space-y-4">
          {mission.map((item, index) => (
            <li key={index} className="grid grid-cols-[2.5rem_1fr] gap-2 border-b border-border pb-4">
              <span aria-hidden className="font-mono text-small text-fg-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="max-w-[65ch] text-body text-fg">{item}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
