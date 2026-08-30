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
      {/* Colour lives here rather than in each session, so all 21 carry the
          same treatment by construction and cannot drift apart one file at a
          time -- which is how the agenda spines had already picked up a
          stray hard-coded purple and a lone --color-ink among otherwise
          consistent tokens.

          Ramy, 30 Aug 2026: "add a little bit of colour to them and sort of
          maybe keep it consistent." A rule and a coloured lead-in is the
          whole of it: these are reference pages a tutor reads before
          teaching, and decoration would compete with the content. */}
      <div className="flex flex-col gap-3">
        <span aria-hidden className="h-[3px] w-10 rounded-full bg-primary" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{eyebrow}</p>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-ink">{title}</h1>
        <p className="text-sm leading-relaxed text-muted">{intro}</p>
      </div>
      {agenda ? (
        <div className="flex flex-col gap-2.5">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            The session
          </p>
          <AgendaStrip items={agenda} />
        </div>
      ) : null}
      {children}
    </div>
  );
}
