import { AgendaStrip, type AgendaItem } from "@/components/input-sessions/agenda-strip";
import { INPUT_SESSIONS } from "@/app/input-sessions/registry";

// Shared header every session opens with: eyebrow (kind + length), title,
// intro, agenda strip. The body between agenda and trainer notes is each
// session's own bespoke content -- this shell only standardizes the parts
// that are genuinely identical across all of them.
//
// Remainder pass A8 (16 Sep 2026): the eyebrow used to be a hand-typed string
// in each of the 31 session files, in five different formats -- "Input session
// · 45 minutes · classroom skills", "Connect · Resource Hub · ~65 minutes · 1
// of 2 — pairs with…", "Input session · 60 minutes core, plus a 30-minute
// online extension". The registry already holds `kind` and `minutes` for every
// session, and the index page has been rendering them all along, so the two
// could disagree and did. The eyebrow is built from the registry entry now and
// the 31 strings are gone; `eyebrow` survives only as an override for a page
// that is not in the registry.
export function SessionShell({
  slug,
  eyebrow,
  title,
  intro,
  agenda,
  children,
}: {
  /** The registry slug -- the eyebrow is read from INPUT_SESSIONS. */
  slug?: string;
  /** Only for a page with no registry entry. */
  eyebrow?: string;
  title: string;
  intro: string;
  agenda?: AgendaItem[];
  children: React.ReactNode;
}) {
  const meta = slug ? INPUT_SESSIONS.find((m) => m.slug === slug) : undefined;
  const line = meta ? `${meta.kind} · ${meta.minutes}` : eyebrow;

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
        {line ? <p className="text-label font-bold uppercase tracking-[0.12em] text-muted">{line}</p> : null}
        <h1 className="font-serif text-display font-semibold leading-tight text-ink">{title}</h1>
        <p className="text-body leading-relaxed text-muted">{intro}</p>
      </div>
      {agenda ? (
        <div className="flex flex-col gap-2.5">
          <p className="flex items-center gap-1.5 text-label font-bold text-primary">
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
