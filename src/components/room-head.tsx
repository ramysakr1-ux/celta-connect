import { BackLink } from "@/components/back-link";

// One head for every room in the administrative building (centre side B1,
// 16 Sep 2026). Twelve heads said the same thing twelve ways: 20px inside a
// card, 24px, 26px, 34px, some with an eyebrow, some with a BackLink and a
// room-name pill beside it, some with neither.
//
// Eyebrow (room · page, or centre · number) · Newsreader 28/600 · one
// paragraph · actions on the right. Never inside a card: a head is the page
// speaking, not a panel on it.
export const ROOM_BUTTON =
  "wash inline-flex h-[38px] items-center rounded-[6px] border border-border bg-card px-4 text-sm font-semibold whitespace-nowrap text-ink";

export const ROOM_PRIMARY =
  "inline-flex h-[38px] items-center rounded-[6px] bg-primary px-4 text-sm font-semibold whitespace-nowrap text-primary-foreground hover:bg-primary/90";

export function RoomHead({
  eyebrow,
  title,
  lede,
  back,
  children,
}: {
  eyebrow?: React.ReactNode;
  /** A name, or a sentence -- Concerns, Roles and the new-course wizard all
   *  speak in sentences, and they keep them, at the head's own size. */
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** Only where the page has no other way back: the dropped room pill already
   *  says which room you are in, so a BackLink beside it says it twice. */
  back?: { href: string; label: string };
  /** Actions, right-aligned: ROOM_BUTTONs and at most one ROOM_PRIMARY. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      {back ? (
        <div className="mb-2">
          <BackLink href={back.href} label={back.label} />
        </div>
      ) : null}
      {eyebrow ? <p className="text-label font-bold tracking-[0.1em] text-muted uppercase">{eyebrow}</p> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-serif text-h1 leading-[1.15] font-semibold text-ink">{title}</h1>
        {children ? <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
      </div>
      {lede ? <p className="mt-1 max-w-[68ch] text-body leading-relaxed text-muted">{lede}</p> : null}
    </div>
  );
}
