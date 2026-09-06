import Link from "next/link";
import type { TintModeration } from "@/lib/tint-moderation";
import { TINT_ASSESSOR_DUTIES } from "@/lib/tint-moderation";

// design_handoff_assessor_landing_v2's trainer-in-training section, rebuilt
// for the MCT's own tab. Present only when the course has a trainer-in-
// training; on every other course this is not there at all.
//
// The point of the block is the day. TinT Handbook §5.2.2 and Administration
// Handbook §13.7 both say assessor moderation means the assessor spends longer
// on the course, usually an extra day -- and a centre timetabling the visit
// from the candidate side alone will not have booked it.

const AMBER = "oklch(44% 0.1 68)";

/**
 * The block, always present, folded away when the course has no
 * trainer-in-training.
 *
 * Ramy, 6 Sep 2026: "when I'm showing this to people, they can see what the
 * page [does]... could we have a pill, strategically positioned, and if you
 * click on it, it drops down and opens the whole card."
 *
 * Worth more than a demo aid. The block is conditional by design -- most
 * courses never have a trainer-in-training -- but that means an MCT who has
 * never had one has no way to discover that having one adds a day to their
 * assessor's visit and five duties to their list. Folded, it says the feature
 * exists; opened, it says what it would cost. It never implies the course has
 * one when it does not.
 *
 * <details> rather than client state: this is a disclosure, and it should work
 * before any JavaScript arrives.
 */
export function TintBlock({
  name,
  supervisorName,
  moderation,
}: {
  /** null when the course has no trainer-in-training. */
  name: string | null;
  supervisorName: string | null;
  moderation: TintModeration;
}) {
  if (!name) return <TintEmpty />;
  return <TintPresent name={name} supervisorName={supervisorName} moderation={moderation} />;
}

function Pill({ label, tone }: { label: string; tone: "accent" | "muted" }) {
  return (
    <span
      className="rounded-full px-2.5 py-[3px] text-[10px] font-bold tracking-[0.07em] uppercase"
      style={
        tone === "accent"
          ? { background: "var(--hub-accent)", color: "var(--color-primary-foreground)" }
          : { border: "1px solid var(--color-border)", color: "var(--color-muted)" }
      }
    >
      {label}
    </span>
  );
}

function TintEmpty() {
  return (
    <details className="trainer-hover group rounded-[14px] border border-border bg-card px-[22px] py-4" style={{ borderTop: "3px solid var(--hub-accent)" }}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--hub-accent-deep)" }}>
          Also on this visit &middot; trainer-in-training
        </span>
        <Pill label="None on this course" tone="muted" />
        <span className="ml-auto text-[12px] font-semibold text-primary">What it would mean</span>
      </summary>
      <div className="mt-4 flex flex-col gap-4">
        <p className="max-w-[76ch] text-sm text-pretty text-muted">
          Nobody on this course is a trainer-in-training, so none of this applies today. It is here so you know what
          changes when one is added &mdash; on the Tutors panel in Centre settings &mdash; because the answer is more than
          a line on a form.
        </p>
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border px-4 py-3"
          style={{ borderColor: `color-mix(in oklab, ${AMBER} 34%, transparent)`, background: `color-mix(in oklab, ${AMBER} 8%, var(--color-card))` }}
        >
          <span className="rounded-full px-2.5 py-[3px] text-[10px] font-bold tracking-[0.07em] uppercase" style={{ background: AMBER, color: "var(--color-primary-foreground)" }}>
            Usually an extra day
          </span>
          <span className="min-w-[280px] flex-1 text-[12.5px] leading-[1.55] text-ink">
            Where moderation applies, your assessor spends longer on the course &mdash; and a visit timetabled from the
            candidate side alone will not have booked it.
          </span>
        </div>
        <div className="hub-hairline flex flex-wrap items-baseline gap-x-3 border-b pb-1.5">
          <h3 className="font-serif text-[16px] font-semibold text-ink">Whether it applies at all depends on the scheme</h3>
          <span className="rounded-full px-2 py-[2px] text-[10px] font-bold tracking-[0.07em] uppercase" style={{ background: "var(--hub-accent)", color: "var(--color-primary-foreground)" }}>
            TinT Handbook &sect;5.1
          </span>
        </div>
        <ul className="flex flex-col">
          {[
            ["External scheme", "assessor moderation required"],
            ["Internal scheme, trainer from another centre", "required"],
            ["Internal scheme, your own trainer", "not required — the supervisor assesses them"],
          ].map(([a, b]) => (
            <li key={a} className="hub-hairline border-t py-2.5 text-[12.5px] text-muted first:border-t-0 first:pt-0">
              <b className="text-ink">{a}</b> &mdash; {b}
            </li>
          ))}
        </ul>
        <div className="hub-hairline flex flex-wrap items-baseline gap-x-3 border-b pb-1.5">
          <h3 className="font-serif text-[16px] font-semibold text-ink">And what the assessor would do with them</h3>
          <span className="rounded-full px-2 py-[2px] text-[10px] font-bold tracking-[0.07em] uppercase" style={{ background: "var(--hub-accent)", color: "var(--color-primary-foreground)" }}>
            TinT Handbook &sect;5.2.2
          </span>
        </div>
        <ul className="flex flex-col">
          {TINT_ASSESSOR_DUTIES.map((d) => (
            <li key={d.label} className="hub-hairline flex flex-col gap-[2px] border-t py-2.5 first:border-t-0 first:pt-0">
              <p className="text-[13px] font-semibold text-ink">{d.label}</p>
              {d.detail ? <p className="text-xs leading-[1.5] text-muted">{d.detail}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function TintPresent({
  name,
  supervisorName,
  moderation,
}: {
  name: string;
  supervisorName: string | null;
  moderation: TintModeration;
}) {
  const heavy = moderation.verdict === "required";
  const unknown = moderation.verdict === "unknown";
  const tone = heavy || unknown ? AMBER : "var(--color-muted)";

  return (
    <details
      open
      className="trainer-hover flex flex-col gap-4 rounded-[14px] border border-border bg-card px-[22px] py-5"
      style={{ borderTop: "3px solid var(--hub-accent)" }}
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--hub-accent-deep)" }}>
          Also on this visit · trainer-in-training
        </span>
        <Pill label={name} tone="accent" />
      </summary>
      <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-[3px]">
        <p className="max-w-[76ch] text-sm text-pretty text-muted">
          <b className="text-ink">{name}</b>
          {supervisorName ? <>, supervised by <b className="text-ink">{supervisorName}</b></> : null}. This is not a candidate
          matter, so it sits apart from the reading and the observation above.
        </p>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border px-4 py-3"
        style={{
          borderColor: heavy || unknown ? `color-mix(in oklab, ${AMBER} 34%, transparent)` : "var(--color-border)",
          background: heavy || unknown ? `color-mix(in oklab, ${AMBER} 8%, var(--color-card))` : "var(--color-card-inset)",
        }}
      >
        <span
          className="rounded-full px-2.5 py-[3px] text-[10px] font-bold tracking-[0.07em] uppercase"
          style={
            heavy
              ? { background: AMBER, color: "var(--color-primary-foreground)" }
              : unknown
                ? { border: `1px solid ${AMBER}`, color: AMBER }
                : { border: "1px solid var(--color-border)", color: "var(--color-muted)" }
          }
        >
          {heavy ? "Moderation required · usually an extra day" : unknown ? "Scheme not recorded" : "No moderation required"}
        </span>
        <span className="min-w-[280px] flex-1 text-[12.5px] leading-[1.55] text-ink">{moderation.because}</span>
      </div>

      {moderation.action ? (
        <p className="text-[12.5px] leading-[1.55]" style={{ color: tone }}>
          <b>What you do about it.</b> {moderation.action}
        </p>
      ) : null}

      {heavy ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 border-b hub-hairline pb-1.5">
            <h3 className="font-serif text-[16px] font-semibold text-ink">What the assessor does with them</h3>
            <span
              className="rounded-full px-2 py-[2px] text-[10px] font-bold tracking-[0.07em] uppercase"
              style={{ background: "var(--hub-accent)", color: "var(--color-primary-foreground)" }}
            >
              TinT Handbook §5.2.2
            </span>
          </div>
          <ul className="flex flex-col">
            {TINT_ASSESSOR_DUTIES.map((d) => (
              <li key={d.label} className="flex flex-col gap-[2px] border-t hub-hairline py-2.5 first:border-t-0 first:pt-0">
                <p className="text-[13px] font-semibold text-ink">{d.label}</p>
                {d.detail ? <p className="text-xs leading-[1.5] text-muted">{d.detail}</p> : null}
              </li>
            ))}
          </ul>
          {moderation.reportTo ? (
            <p className="rounded-[10px] bg-card-inset px-4 py-3 text-[12.5px] leading-[1.55] text-ink">
              <b>Afterwards</b>, the assessor completes the <i>CELTA Trainer-in-Training Assessor Moderation Report</i> and sends
              it to {moderation.reportTo}. It is not part of the assessor report, and Connect does not hold it. The content is
              discussed with {name} and their supervisor.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t hub-hairline pt-3">
        {/* The record has its own tab in this hub; this is a pointer to it, not
            a second copy of the door. */}
        <Link href="/trainer/trainer-in-training" className="text-[12.5px] font-semibold text-primary hover:underline">
          Open the Trainer-in-Training tab
        </Link>
        <span className="text-[11.5px] text-muted">
          The e-portfolio, the shadow-marking record and both signature trails live there. Your assessor reaches it from the
          pack.
        </span>
      </div>
      </div>
    </details>
  );
}
