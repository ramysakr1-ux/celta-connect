export interface AgendaItem {
  time: string;
  title: string;
  spine: string;
}

// specs/handoffs/*/Input Session.dc.html's shared shape: a time-blocked
// strip at the top of every session, colored spine per segment. Grid
// columns scale to however many blocks a given session has (most run
// 5-8) rather than a fixed count.
export function AgendaStrip({ items }: { items: AgendaItem[] }) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 8)}, minmax(0, 1fr))` }}
    >
      {items.map((a, i) => (
        <div key={i} className="flex flex-col gap-1 rounded-[6px] border border-border bg-card p-2.5" style={{ borderLeft: `3px solid ${a.spine}` }}>
          <p className="text-[9.5px] font-bold tracking-[0.03em] text-muted">{a.time}</p>
          <p className="text-[11px] font-semibold leading-tight text-ink">{a.title}</p>
        </div>
      ))}
    </div>
  );
}
