import Link from "next/link";
import type { AssessorRequirement } from "@/lib/assessor-requirements";
import { tutorRoleLabel } from "@/lib/tutor-roles";

// design_handoff_assessor_landing_v2, the right-hand margin: the pack, the
// day, what the Handbook asks, and what else is on file. Read-only.

const BROWN = "oklch(30% 0.042 58)";
const AMBER = "oklch(44% 0.1 68)";
const RED = "oklch(45% 0.16 27)";

export type PackState = "in" | "part" | "missing" | "later";

export interface PackRow {
  name: string;
  meta: string;
  state: PackState;
  href?: string;
}

export interface DayRow {
  time: string;
  title: string;
  sub: string | null;
  isTp: boolean;
}

function RailHeading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-[10px] font-bold tracking-[0.11em] uppercase" style={{ color: BROWN }}>
        {children}
      </span>
      {right}
    </div>
  );
}

function PackSquare({ state }: { state: PackState }) {
  const style: React.CSSProperties =
    state === "in"
      ? { background: "var(--color-ink)", borderColor: "var(--color-ink)" }
      : state === "part"
        ? { background: `color-mix(in oklab, ${AMBER} 35%, transparent)`, borderColor: AMBER }
        : state === "missing"
          ? { background: "transparent", borderColor: AMBER }
          : { background: "transparent", borderColor: "var(--color-border)" };
  return <span className="mt-[3px] block size-2.5 shrink-0 rounded-[2px] border" style={style} />;
}

export function VisitRail({
  pack,
  dayLabel,
  dayRows,
  timetableHref,
  requirements,
  alsoOnFile,
  tutors,
}: {
  pack: PackRow[];
  dayLabel: string | null;
  dayRows: DayRow[];
  timetableHref: string;
  requirements: AssessorRequirement[];
  alsoOnFile: { label: string; value: string; href?: string }[];
  tutors: { name: string; role: string | null }[];
}) {
  const inCount = pack.filter((p) => p.state === "in").length;
  const missingCount = pack.filter((p) => p.state === "missing").length;
  const laterCount = pack.filter((p) => p.state === "later").length;

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-2">
        <RailHeading
          right={
            <span className="text-[11px]" style={{ color: missingCount > 0 ? AMBER : "var(--color-muted)" }}>
              {inCount} of {pack.length} in{missingCount > 0 ? ` · ${missingCount} missing` : ""}
              {laterCount > 0 ? ` · ${laterCount} on the day` : ""}
            </span>
          }
        >
          The pack
        </RailHeading>
        <div className="flex flex-col">
          {pack.map((row) => {
            const body = (
              <>
                <PackSquare state={row.state} />
                <span className="min-w-0 flex-1 text-[12px]" style={{ color: row.state === "missing" ? AMBER : "var(--color-ink)" }}>
                  {row.name}
                </span>
                <span className="shrink-0 text-[10.5px] text-muted">{row.meta}</span>
              </>
            );
            return row.href ? (
              <Link key={row.name} href={row.href} className="flex items-start gap-2.5 border-t border-border-faint py-[7px] first:border-t-0 hover:underline">
                {body}
              </Link>
            ) : (
              <div key={row.name} className="flex items-start gap-2.5 border-t border-border-faint py-[7px] first:border-t-0">
                {body}
              </div>
            );
          })}
        </div>
      </section>

      {dayLabel ? (
        <section className="flex flex-col gap-2">
          <RailHeading
            right={
              <Link href={timetableHref} className="text-[11px] font-semibold text-primary hover:underline">
                Course timetable
              </Link>
            }
          >
            {dayLabel}
          </RailHeading>
          <div className="flex flex-col">
            {dayRows.map((row, i) => (
              <div key={`${row.time}-${i}`} className="grid grid-cols-[44px_1fr] items-baseline gap-2 border-t border-border-faint py-[7px] first:border-t-0">
                <span className="text-[11px] text-muted tabular-nums">{row.time}</span>
                <span className="flex min-w-0 flex-col">
                  <span className={`text-[12px] text-ink ${row.isTp ? "font-semibold" : ""}`}>{row.title}</span>
                  {row.sub ? <span className="text-[10.5px] text-muted">{row.sub}</span> : null}
                </span>
              </div>
            ))}
            {dayRows.length === 0 ? <p className="py-2 text-[11.5px] text-muted">Nothing on the timetable for that day yet.</p> : null}
          </div>
          <p className="text-[10.5px] leading-[1.5] text-muted">
            Which two you observe is decided on the day. Lesson plans are handed over as each lesson starts.
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        {/* <details> gives the design's Show/Hide with no client state. */}
        <details open>
          <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2">
            <span className="text-[10px] font-bold tracking-[0.11em] uppercase" style={{ color: BROWN }}>
              What the Handbook asks of this visit
            </span>
            <span className="text-[11px] font-semibold text-primary">Show / hide</span>
          </summary>
          <div className="mt-2 flex flex-col">
            {requirements.map((r) => (
              <div key={r.label} className="flex flex-col gap-[2px] border-t border-border-faint py-2 first:border-t-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-semibold text-ink">{r.label}</span>
                  <span className="shrink-0 text-[10px] font-semibold text-muted tabular-nums">§{r.cite}</span>
                </div>
                <p className="text-[11px] leading-[1.45] text-muted">{r.detail}</p>
                {/* The design's "hot" line: the part that is true of THIS
                    course rather than of every course, in red. */}
                {r.emphasis ? (
                  <p className="text-[11px] leading-[1.45]" style={{ color: RED }}>
                    {r.emphasis}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="flex flex-col gap-2 border-t border-border pt-3">
        <RailHeading>Also on file</RailHeading>
        <div className="flex flex-col gap-1.5">
          {alsoOnFile.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 text-[11.5px]">
              <span className="text-muted">{row.label}</span>
              {row.href ? (
                <Link href={row.href} className="text-right text-[11px] font-semibold whitespace-nowrap text-primary hover:underline">
                  {row.value}
                </Link>
              ) : (
                <span className="text-right text-[11px] font-semibold whitespace-nowrap text-ink">{row.value}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* The pack's "Tutor list and roles" row jumps here rather than
          opening a page -- there is no other screen a token-only assessor
          reaches that just lists the tutors. .assessor-anchor pulls the
          target clear and tints it briefly so the jump lands visibly. */}
      {tutors.length > 0 ? (
        <section id="tutor-list" className="assessor-anchor flex flex-col gap-2">
          <RailHeading>Tutor list</RailHeading>
          <div className="flex flex-col gap-1">
            {tutors.map((t) => (
              <p key={`${t.name}-${t.role}`} className="text-[11.5px] text-ink">
                {t.name}
                {t.role ? <span className="text-muted"> · {tutorRoleLabel(t.role)}</span> : null}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <RailHeading>Not in this pack</RailHeading>
        <div className="flex flex-col gap-2">
          {[
            { title: "The assessor's own report", why: "Goes to Cambridge's own secure system, not here." },
            { title: "Staff chat", why: "Trainer-only, resets on the centre's schedule." },
            { title: "Trainee-only chat", why: "A deliberate privacy boundary." },
          ].map((x) => (
            <div key={x.title}>
              <p className="text-[11.5px] font-semibold text-ink">{x.title}</p>
              <p className="text-[11px] leading-[1.45] text-muted">{x.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* for-claude-code-assessor-tour-mode.md. Plain <a>, not <Link>:
          /assessor/tour is a route handler that sets a cookie and redirects,
          and Link's prefetch would trigger it before anyone clicked. */}
      <section className="flex flex-col gap-2 border-t border-border pt-3">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/assessor/tour" className="text-[11.5px] font-semibold text-primary no-underline hover:underline">
          Take a tour of the platform
        </a>
        <p className="text-[11px] leading-[1.45] text-muted">
          Browse the wider platform read-only — the trainer dashboard, a candidate&apos;s full portfolio, the timetable,
          the resource hub. Not required reading; it is here if you are curious how the platform works day to day.
        </p>
      </section>
    </div>
  );
}
