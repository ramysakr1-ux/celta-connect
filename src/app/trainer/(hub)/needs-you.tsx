"use client";

import Link from "next/link";
import { useState } from "react";

// The spine of Today: every alert, none hidden.
//
// Ramy, 4 Sep 2026, on the old panel: "Needs you · 17" in the header and
// three rows underneath. The header rendered alerts.length, the body
// rendered alerts.slice(0, 3), and the other fourteen had no route at all.
// The whole list renders here. If it is long it scrolls with the page.
//
// The filter is a control on the list, not a third row of navigation --
// Ramy: "there's so many tabs everywhere right now." So it is one joined
// segment labelled "Show", with a dot in each kind's badge colour and a count,
// and the active option underlined rather than filled. Nothing in it goes
// anywhere; it only narrows what is below.

export type AlertKind = "tp" | "marking" | "admin" | "candidate";

export interface TodayAlert {
  kind: AlertKind;
  /** Two or three characters on the badge -- TP, A1, 74%. */
  badge: string;
  title: string;
  meta: string;
  href: string;
  /** Right-aligned; "Now" and "Today" read in red. */
  due: string;
  destructive?: boolean;
}

const KIND: Record<AlertKind, { label: string; tone: string; badgeInk: string }> = {
  tp: { label: "TP", tone: "var(--color-primary)", badgeInk: "var(--color-primary-foreground)" },
  marking: { label: "Marking", tone: "var(--color-gold)", badgeInk: "var(--color-ink)" },
  admin: { label: "Admin", tone: "var(--color-ink-warm)", badgeInk: "var(--color-primary-foreground)" },
  candidate: { label: "Candidates", tone: "var(--color-destructive)", badgeInk: "var(--color-primary-foreground)" },
};

const ORDER: AlertKind[] = ["tp", "marking", "admin", "candidate"];

export function NeedsYou({ alerts, accent }: { alerts: TodayAlert[]; accent: string }) {
  const [show, setShow] = useState<AlertKind | "all">("all");
  const counts = new Map<AlertKind, number>();
  for (const a of alerts) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
  const visible = show === "all" ? alerts : alerts.filter((a) => a.kind === show);

  return (
    <section
      className="flex flex-col rounded-[14px] border border-border bg-frame"
      style={{ boxShadow: "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px oklch(30% 0.04 58 / 0.06)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pt-4 pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <h2 className="font-serif text-[24px] font-semibold text-ink-warm">Needs you</h2>
          <span className="text-[12.5px] text-muted">
            {alerts.length} &middot; all shown
          </span>
        </div>
        {alerts.length > 0 ? (
          <div className="inline-flex items-center gap-2 text-[11.5px] text-muted">
            <span>Show</span>
            <span className="inline-flex overflow-hidden rounded-[7px] border border-border bg-card">
              <FilterButton active={show === "all"} onClick={() => setShow("all")} accent={accent}>
                All <Count n={alerts.length} />
              </FilterButton>
              {ORDER.filter((k) => counts.get(k)).map((k) => (
                <FilterButton key={k} active={show === k} onClick={() => setShow(k)} accent={accent}>
                  <span className="size-[7px] rounded-full" style={{ background: KIND[k].tone }} />
                  {KIND[k].label} <Count n={counts.get(k) ?? 0} />
                </FilterButton>
              ))}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col px-2.5 pb-2.5">
        {alerts.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">Nothing needs you right now.</p>
        ) : (
          visible.map((a, i) => (
            <Link
              key={`${a.kind}-${i}-${a.title}`}
              href={a.href}
              className="trainer-hover grid grid-cols-[40px_1fr_auto] items-center gap-3.5 rounded-[10px] px-3 py-[11px]"
            >
              <span
                className="flex size-10 items-center justify-center rounded-[10px] text-[11.5px] font-bold tracking-[0.02em]"
                style={{ background: KIND[a.kind].tone, color: KIND[a.kind].badgeInk }}
              >
                {a.badge}
              </span>
              <span className="min-w-0">
                <span className={`block text-[14px] font-semibold ${a.destructive ? "text-destructive" : "text-ink"}`}>{a.title}</span>
                <span className="block truncate text-[12.5px] text-muted">{a.meta}</span>
              </span>
              <span className={`text-[12px] font-semibold whitespace-nowrap ${/^(now|today)$/i.test(a.due) ? "text-destructive" : "text-muted"}`}>
                {a.due}
              </span>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function Count({ n }: { n: number }) {
  return <span className="font-medium opacity-75 tabular-nums">{n}</span>;
}

function FilterButton({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 border-r border-border px-[11px] text-[12px] font-semibold last:border-r-0 ${
        active ? "bg-frame" : "text-muted hover:bg-card-inset hover:text-ink"
      }`}
      style={active ? { color: accent, boxShadow: `inset 0 -2px 0 ${accent}` } : undefined}
    >
      {children}
    </button>
  );
}
