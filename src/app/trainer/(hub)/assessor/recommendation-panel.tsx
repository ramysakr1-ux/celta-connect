"use client";

import { useState, useTransition } from "react";
import type { AssessorRecommendation, RecommendedCandidate } from "@/lib/assessor-recommendation";
import { recordObservationChoice } from "@/app/trainer/(hub)/assessor/observation-actions";

// design_handoff_assessor_landing_v2, rebuilt for the MCT's own tab.
//
// The panel says what Connect suggests and, line by line, whether the reason
// is a Handbook rule or the custom an experienced MCT works to. That
// distinction is the whole point: Ramy, 6 Sep 2026, on the grade tier -- "it's
// not a rule but it's a tradition, so it's actually not a bad recommendation
// to have." A tradition is worth printing; a tradition wearing a section
// number is not.

const AMBER = "oklch(44% 0.1 68)";
const RED = "oklch(45% 0.16 27)";

function gradeStyle(label: string | null): React.CSSProperties {
  if (!label) return { background: "oklch(95% 0.008 85)", color: "var(--color-muted)" };
  if (/Fail/.test(label)) return { background: `color-mix(in oklab, ${RED} 14%, var(--color-card))`, color: RED };
  if (label === "Pass A") return { background: "color-mix(in oklab, oklch(60% 0.11 70) 20%, var(--color-card))", color: "oklch(40% 0.09 68)" };
  if (label === "Pass B") return { background: "oklch(93% 0.012 85)", color: "oklch(40% 0.02 70)" };
  return { background: "oklch(95% 0.008 85)", color: "var(--color-muted)" };
}

function Provenance({ kind }: { kind: "handbook" | "custom" }) {
  return kind === "handbook" ? (
    <span
      className="rounded-full px-2 py-[2px] text-[9.5px] font-bold tracking-[0.07em] uppercase"
      style={{ background: "var(--hub-accent)", color: "var(--color-primary-foreground)" }}
    >
      Handbook
    </span>
  ) : (
    <span className="rounded-full border px-2 py-[2px] text-[9.5px] font-bold tracking-[0.07em] text-primary uppercase" style={{ borderColor: "color-mix(in oklab, var(--color-primary) 45%, transparent)" }}>
      Common practice
    </span>
  );
}

function Card({ c, muted = false }: { c: RecommendedCandidate; muted?: boolean }) {
  return (
    <div
      className="flex flex-col gap-2 rounded-[8px] border border-border bg-card px-4 py-3"
      style={muted ? { opacity: 0.72, background: "var(--color-card-inset)" } : { boxShadow: "inset 0 3px 0 var(--hub-accent)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-serif text-[18px] leading-tight font-semibold text-ink">{c.name}</span>
          <span className="truncate text-[11px] text-muted">
            {[c.groupName, c.slot].filter(Boolean).join(" · ") || "Not teaching on the visit day"}
          </span>
        </span>
        <span className="inline-flex h-[22px] shrink-0 items-center rounded-full px-[9px] text-[10.5px] font-bold whitespace-nowrap" style={gradeStyle(c.provisionalLabel)}>
          {c.provisionalLabel ?? "No grade yet"}
        </span>
      </div>
      <p className="text-[12px] leading-[1.45] text-pretty" style={{ color: c.provenance === "handbook" ? "var(--color-ink)" : "var(--color-muted)" }}>
        {c.why}
      </p>
      <div className="border-t border-border-faint pt-2">
        <Provenance kind={c.provenance} />
      </div>
    </div>
  );
}

function Heading({ title, cite, note }: { title: string; cite: string; note?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border-faint pb-1.5 first:mt-0">
      <h3 className="font-serif text-[16px] font-semibold text-ink">{title}</h3>
      <span className="rounded-full px-2 py-[2px] text-[10px] font-bold tracking-[0.07em] uppercase" style={{ background: "var(--hub-accent)", color: "var(--color-primary-foreground)" }}>
        {cite}
      </span>
      {note ? <span className="text-[12px] text-muted">{note}</span> : null}
    </div>
  );
}

export function RecommendationPanel({
  rec,
  visitDateLabel,
  existing,
}: {
  rec: AssessorRecommendation;
  visitDateLabel: string | null;
  /** The centre's last recorded choice, if there is one. */
  existing: { names: string[]; source: "connect" | "centre"; reason: string | null; by: string; at: string } | null;
}) {
  const [overriding, setOverriding] = useState(false);
  const [picked, setPicked] = useState<string[]>(rec.observe.map((o) => o.traineeId));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // A transition rather than useActionState, so the sheet can close itself the
  // moment the write lands -- and stay open, with the typed reason intact,
  // when it does not.
  const action = (formData: FormData) => {
    startTransition(async () => {
      const result = await recordObservationChoice({ error: null }, formData);
      setError(result.error);
      if (!result.error) setOverriding(false);
    });
  };

  const pool = [...rec.observe, ...rec.alsoTeaching];
  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 2 ? [prev[1], id] : [...prev, id]));

  return (
    <section className="flex flex-col gap-1 rounded-[14px] border border-border bg-card px-[22px] py-5" style={{ borderTop: "3px solid var(--hub-accent)" }}>
      <p className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--hub-accent-deep)" }}>
        What Connect suggests
      </p>
      <p className="max-w-[76ch] text-sm text-pretty text-muted">
        Reading is settled first, because it is the part the Handbook constrains. Observation is then chosen from whoever
        teaches {visitDateLabel ? `on ${visitDateLabel}` : "on the visit day"}, so that at least one observed candidate is
        also being read. Every line says whether it comes from the Handbook or from custom.
      </p>
      {/* Ramy, 30 Aug 2026, on the assessor's own page: "I'm not sure what
          those numbers are. 15.1, 14.2. What are they?" A bare § is only
          meaningful to someone who already knows which document it belongs to.
          Said once here rather than on every pill. */}
      <p className="text-xs text-muted">
        § numbers are the CELTA Administration Handbook, June 2025, so any line here can be checked rather than taken on trust.
      </p>

      <Heading
        title="Read in full"
        cite={`§14.2 · ${rec.readTarget} portfolios`}
        note="more than two Fail on a course and the assessor focuses on the borderline cases"
      />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rec.read.map((c) => (
          <Card key={c.traineeId} c={c} />
        ))}
        {rec.read.length === 0 ? <p className="text-[12.5px] text-muted">No candidates to read yet.</p> : null}
      </div>

      {rec.alsoWorthReading ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[8px] border border-dashed px-4 py-3"
          style={{ borderColor: "color-mix(in oklab, var(--color-primary) 40%, transparent)", background: "var(--color-card-inset)" }}
        >
          <Provenance kind="custom" />
          <span className="font-serif text-[17px] leading-tight font-semibold text-ink">{rec.alsoWorthReading.name}</span>
          <span className="inline-flex h-[22px] items-center rounded-full px-[9px] text-[10.5px] font-bold" style={gradeStyle(rec.alsoWorthReading.provisionalLabel)}>
            {rec.alsoWorthReading.provisionalLabel ?? "No grade yet"}
          </span>
          <span className="min-w-[220px] flex-1 text-[12px] leading-[1.45] text-muted">
            <b className="text-ink">Also worth a look, if there is time.</b> {rec.alsoWorthReading.why}
          </span>
        </div>
      ) : null}

      {rec.noPool ? (
        <p className="mt-4 text-[12.5px] leading-[1.5] text-muted">
          Nobody is timetabled to teach on the visit day, so there is nothing to recommend observing. The visit-day notice
          above says what to do about that.
        </p>
      ) : (
        <>
          <Heading title="Observe teaching" cite="§14.2 · two candidates, 1½ hours or more" note={`only ${pool.length} teach${pool.length === 1 ? "es" : ""} that day`} />
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rec.observe.map((c) => (
              <Card key={c.traineeId} c={c} />
            ))}
          </div>
          {/* Ramy, 6 Sep 2026: "why is the Pass there as well?" -- the four
              teaching candidates Connect does NOT suggest were getting a full
              card each, so six people appeared here and again in the cohort
              below. They are named, because which two get observed is agreed
              on the day and you may want a different one; they do not need a
              card twice on the same page. */}
          {rec.alsoTeaching.length > 0 ? (
            <p className="mt-2.5 text-[12px] leading-[1.5] text-muted">
              <b className="text-ink">Also teaching that day:</b>{" "}
              {rec.alsoTeaching.map((c) => c.name).join(", ")}. Their plans are in the pack either way, and the assessor can
              choose any of them on the day.
            </p>
          ) : null}

          <div
            className="mt-3.5 rounded-[8px] border px-4 py-3 text-[12.5px] leading-[1.55] text-ink"
            style={{
              borderColor: rec.overlapWaived ? `color-mix(in oklab, ${AMBER} 34%, transparent)` : "color-mix(in oklab, var(--hub-accent) 24%, transparent)",
              background: rec.overlapWaived ? `color-mix(in oklab, ${AMBER} 8%, var(--color-card))` : "var(--color-card-inset)",
            }}
          >
            {rec.overlapWaived ? (
              <>
                <b>No overlap, and that is allowed here.</b> None of the candidates being read in full teaches on the visit
                day. §14.2 asks for at least one observed candidate&apos;s portfolio to be read &mdash; unless the number of
                Pass/Fail candidates makes that impossible, which is the case on this course. The borderline reading wins.
              </>
            ) : (
              <>
                <b>The two lists fit together.</b> {rec.overlapCount === 1 ? "One candidate is" : `${rec.overlapCount} candidates are`} on
                both, which is what §14.2 asks for: the portfolio of at least one observed candidate must be read in full.
              </>
            )}
          </div>

          {existing ? (
            <p className="mt-3 text-[11.5px] text-muted">
              Recorded: <b className="text-ink">{existing.names.join(" and ")}</b>
              {existing.source === "centre" ? " — your choice, not Connect's" : " — Connect's suggestion, accepted"} · {existing.by} ·{" "}
              {existing.at}
              {existing.reason ? <span className="block">&ldquo;{existing.reason}&rdquo;</span> : null}
            </p>
          ) : null}

          {error ? (
            <p className="mt-3 text-[12px] font-semibold" style={{ color: RED }}>
              {error}
            </p>
          ) : null}

          {overriding ? (
            <form action={action} className="mt-3 overflow-hidden rounded-[10px] border" style={{ borderColor: "color-mix(in oklab, var(--hub-accent) 34%, transparent)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--hub-accent)", color: "var(--color-primary-foreground)" }}>
                <span>Choose different candidates</span>
                <span className="text-[11.5px] font-normal opacity-85">pick two of the {pool.length} teaching that day</span>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3.5">
                <input type="hidden" name="source" value="centre" />
                {rec.observe.map((o) => (
                  <input key={o.traineeId} type="hidden" name="recommended_id" value={o.traineeId} />
                ))}
                {pool.map((c) => {
                  const on = picked.includes(c.traineeId);
                  return (
                    <label
                      key={c.traineeId}
                      className="flex cursor-pointer items-center gap-3 rounded-[7px] border px-3 py-2.5 transition-colors"
                      style={{
                        borderColor: on ? "color-mix(in oklab, var(--hub-accent) 45%, transparent)" : "var(--color-border)",
                        background: on ? "color-mix(in oklab, var(--hub-accent) 6%, var(--color-card))" : "var(--color-card)",
                      }}
                    >
                      <input type="checkbox" name="trainee_id" value={c.traineeId} checked={on} onChange={() => toggle(c.traineeId)} className="size-[15px] accent-[var(--hub-accent)]" />
                      <span className="text-[13px] font-semibold text-ink">{c.name}</span>
                      <span className="ml-auto text-right text-[11.5px] text-muted">
                        {[c.slot, c.provisionalLabel ?? "No grade yet"].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  );
                })}
                <label className="mt-1 flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">Why you are choosing differently</span>
                  <textarea
                    name="reason"
                    rows={2}
                    required
                    minLength={3}
                    className="rounded-[7px] border border-border bg-card px-3 py-2.5 text-[12.5px] text-ink"
                    placeholder="Nadia asked to be observed, and Priya was observed at the last visit…"
                  />
                </label>
                <p className="border-t border-border-faint pt-2.5 text-[11.5px] text-muted">
                  Recorded against the visit with your name and today&apos;s date, and kept &mdash; a later change adds a
                  row rather than replacing this one.
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button type="submit" disabled={pending} className="rounded-[6px] px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-[1.12] disabled:opacity-60" style={{ background: "var(--hub-accent)" }}>
                    {pending ? "Saving…" : "Save my choice"}
                  </button>
                  <button type="button" onClick={() => setOverriding(false)} className="trainer-hover-fill rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink">
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
              <form action={action} className="contents">
                <input type="hidden" name="source" value="connect" />
                {rec.observe.map((o) => (
                  <input key={o.traineeId} type="hidden" name="trainee_id" value={o.traineeId} />
                ))}
                {rec.observe.map((o) => (
                  <input key={`r-${o.traineeId}`} type="hidden" name="recommended_id" value={o.traineeId} />
                ))}
                <button type="submit" disabled={pending || rec.observe.length === 0} className="rounded-[6px] px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-[1.12] disabled:opacity-60" style={{ background: "var(--hub-accent)" }}>
                  {pending ? "Saving…" : "Accept this suggestion"}
                </button>
              </form>
              <button type="button" onClick={() => setOverriding(true)} className="trainer-hover-fill rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink">
                Choose different candidates
              </button>
              <span className="min-w-[240px] flex-1 text-[11.5px] leading-[1.45] text-muted">
                Advisory. Accepting records your proposal with your name against the visit; it does not narrow what the
                assessor sees. The choice is theirs, in consultation with you (§15.1).
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
