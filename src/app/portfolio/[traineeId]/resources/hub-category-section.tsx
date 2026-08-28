// Ramy, 29 Aug 2026: "I don't want to have collapsibles any more. Nothing
// will collapse." Every category was a card you had to click open, which
// meant finding anything took a click to guess, a click to open, and a
// click to close again -- on a page whose whole job is letting you find
// something. A category is a heading over its own contents now.
//
// This replaced a client component with a plain server one: the only state
// it ever held was open/closed.
export function HubCategorySection({
  label,
  count,
  restricted,
  children,
}: {
  label: string;
  count: string;
  restricted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[8px] border border-border p-[16px_18px]" style={{ background: "oklch(99.2% 0.005 90)" }}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="font-serif text-[11px] font-bold tracking-[0.09em] text-ink uppercase">{label}</h3>
        <div className="flex shrink-0 items-baseline gap-2">
          {restricted ? (
            <span className="rounded-full border border-border bg-surface-muted px-2 py-[1px] text-[10px] font-semibold text-muted">
              Trainer only
            </span>
          ) : null}
          <span className="text-[11px] tabular-nums text-muted">{count}</span>
        </div>
      </div>
      {children}
    </section>
  );
}
