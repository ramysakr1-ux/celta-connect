"use client";

import { useTransition } from "react";
import type { PrepItemState, PrepSummary } from "@/lib/assessor-prep-state";
import { markPrepItem } from "@/app/trainer/(hub)/assessor/prep-actions";

// Handbook 14.1's list, with state.
//
// A derived item shows what Connect actually looked at and cannot be ticked --
// letting someone tick "the course timetable is ready" while the timetable is
// empty would make the whole list worthless. A centre-held item gets a real
// checkbox, and records who ticked it.

const AMBER = "oklch(44% 0.1 68)";
const TEAL = "oklch(37.5% 0.058 195)";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function Row({ item, pending, onToggle }: { item: PrepItemState; pending: boolean; onToggle: (key: string, done: boolean) => void }) {
  const ready = item.status === "ready";
  const na = item.status === "not_applicable";
  const tone = ready ? TEAL : na ? "var(--color-muted)" : AMBER;

  return (
    <li className="flex flex-col gap-[3px] border-t border-border-faint py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          {item.derived ? (
            // Not a control: a derived answer is a reading, and a checkbox
            // here would invite someone to overrule the data with a click.
            <span
              className="mt-[1px] inline-flex size-[13px] shrink-0 items-center justify-center rounded-[3px] border text-[8px] font-bold"
              style={
                ready
                  ? { background: TEAL, borderColor: TEAL, color: "var(--color-primary-foreground)" }
                  : { borderColor: tone, color: tone }
              }
              title={ready ? "Connect can see this is ready" : "Connect can see this is not ready"}
            >
              {ready ? "✓" : na ? "–" : "!"}
            </span>
          ) : (
            <input
              type="checkbox"
              checked={ready}
              disabled={pending}
              onChange={() => onToggle(item.key, !ready)}
              className="mt-[1px] size-[13px] shrink-0 accent-[var(--hub-accent)] disabled:opacity-50"
              aria-label={`Mark ${item.label} as ready`}
            />
          )}
          <span className="text-[13px] font-semibold text-ink">
            {item.label}
            {item.conditional ? <span className="ml-2 text-[10px] font-bold tracking-[0.08em] text-gold uppercase">This course</span> : null}
          </span>
        </span>
        <span className="shrink-0 text-[10px] font-semibold text-muted tabular-nums">§{item.cite}</span>
      </div>
      <p className="pl-[21px] text-xs text-muted">{item.detail}</p>
      {item.evidence ? (
        <p className="pl-[21px] text-[11px] font-medium" style={{ color: tone }}>
          {item.evidence}
        </p>
      ) : null}
      {item.markedByName && ready ? (
        <p className="pl-[21px] text-[11px] text-muted">
          Confirmed by {item.markedByName}
          {item.markedAt ? ` · ${fmt(item.markedAt)}` : ""}
        </p>
      ) : null}
    </li>
  );
}

export function PrepList({ summary, deadline }: { summary: PrepSummary; deadline: string | null }) {
  const [pending, start] = useTransition();

  const toggle = (key: string, done: boolean) =>
    start(async () => {
      const fd = new FormData();
      fd.set("item_key", key);
      fd.set("done", String(done));
      await markPrepItem({ error: null }, fd);
    });

  const allReady = summary.outstanding.length === 0;

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-card px-[22px] py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">What the assessor needs from you</p>
          <p className="max-w-[70ch] text-sm text-muted">
            Administration Handbook §14.1.{" "}
            {deadline
              ? `Available by ${deadline} — two to three days before the visit, so the assessor can read it.`
              : "Set a visit date and Connect will date this list for you."}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[11.5px] font-semibold whitespace-nowrap"
          style={
            allReady
              ? { background: `color-mix(in oklab, ${TEAL} 14%, var(--color-card))`, color: TEAL }
              : { background: `color-mix(in oklab, ${AMBER} 14%, var(--color-card))`, color: AMBER }
          }
        >
          {allReady ? `All ${summary.total} ready` : `${summary.outstanding.length} of ${summary.total} not ready`}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 xl:grid-cols-3">
        {summary.items.map((item) => (
          <Row key={item.key} item={item} pending={pending} onToggle={toggle} />
        ))}
      </ul>

      <p className="border-t border-border-faint pt-3 text-[11.5px] text-muted">
        Ticks are yours and Course Admin&apos;s — whoever prepared the thing can say it is ready, and their name goes on it.
        The items Connect can see for itself have no tick: the reading underneath each one is what it looked at.
      </p>
    </section>
  );
}
