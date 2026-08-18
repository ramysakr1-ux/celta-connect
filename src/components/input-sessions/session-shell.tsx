import { AgendaStrip, type AgendaItem } from "@/components/input-sessions/agenda-strip";

// Shared header every session opens with: eyebrow (length + kind), title,
// intro, agenda strip. The body between agenda and trainer notes is each
// session's own bespoke content -- this shell only standardizes the parts
// that are genuinely identical across all of them.
export function SessionShell({
  eyebrow,
  title,
  intro,
  agenda,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  agenda?: AgendaItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-7 pb-16">
      <div className="flex flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-ink">{title}</h1>
        <p className="text-sm leading-relaxed text-muted">{intro}</p>
      </div>
      {agenda ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-bold text-ink">The session</p>
          <AgendaStrip items={agenda} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
