// The one page head every hub tab uses.
//
// design_handoff_trainer_homepage_v4, "Page header": eyebrow 11.5px
// uppercase bold muted; heading Newsreader 34px/600 ink-brown; actions on
// the right, one solid button in the role accent. Today set the pattern on
// 5 Sep 2026; Ramy: "the same colour theme and the same tidiness throughout
// all the tabs -- the roster, the timetable, the volunteers." So the head
// is a component, not a convention.

export const HUB_BUTTON = "trainer-hover-fill inline-flex h-10 items-center gap-1.5 rounded-[8px] border border-border bg-card px-3.5 text-[13px] font-medium text-ink whitespace-nowrap";
export const HUB_BUTTON_SMALL = "trainer-hover-fill inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[12.5px] font-medium text-ink whitespace-nowrap";
export const HUB_PRIMARY = "inline-flex h-10 items-center rounded-[8px] px-[18px] text-[13.5px] font-bold text-primary-foreground whitespace-nowrap transition-[filter] hover:brightness-110";
export const HUB_PRIMARY_STYLE = { background: "var(--hub-accent)" } as const;

export function PageHead({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  /** One sentence under the heading, when the page needs one. */
  lede?: React.ReactNode;
  /** Actions, right-aligned: secondary HUB_BUTTONs and at most one HUB_PRIMARY. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">{eyebrow}</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">{title}</h1>
        {lede ? <p className="mt-1 max-w-[70ch] text-sm text-muted">{lede}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
