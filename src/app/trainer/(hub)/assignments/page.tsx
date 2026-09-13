import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { computeCourseDayProgress } from "@/lib/course-day";
import { getCourseReleaseClock } from "@/lib/assignment-release";
import { getAllAssignmentCriteria } from "@/lib/assignment-criteria";
import { ASSIGNMENT_INFO, ASSIGNMENT_ORDER } from "@/lib/assignment-info";
import {
  boardCell,
  buildQueue,
  buildSample,
  type BoardCell,
  type BoardCellState,
} from "@/lib/assignment-board";
import { TpSheet } from "@/components/tp-sheet";
// Tokens come from the plain module, never from tp-sheet: that file is
// "use client", and a client module's exports reach a server component as
// references rather than values.
import { BAND, BORDER, CARD, FAINT, GARNET, GOLD_INK, INK, MUTED, SHEET, TEAL, ZEBRA } from "@/lib/sheet-tokens";
import type { Database } from "@/lib/supabase/types";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

// design_handoff_tutor_assignments §1 -- the tutor's front page for written
// assignments. There was no such page: a tutor reached an assignment through
// the roster, one candidate at a time, and nothing anywhere showed the
// marking as a whole -- what is waiting, what is half-marked, what needs a
// second pair of eyes, and whether the centre's double-marked sample is
// actually full.
//
// The grid is the whole cohort deliberately, not the tutor's own TP group:
// marking written assignments is a course-wide job usually split by
// assignment rather than by group, and the Handbook's double-marking quota is
// counted per course. The QUEUE is the personal view -- it carries only what
// this tutor has to do.

const CLOSED_INK = "oklch(64% 0.015 70)";

interface ChipLook {
  fill: string;
  border: string;
  text: string;
  dashed?: boolean;
}

const CHIP: Record<BoardCellState, ChipLook> = {
  locked: { fill: "transparent", border: FAINT, text: CLOSED_INK, dashed: true },
  writing: { fill: SHEET, border: BORDER, text: MUTED },
  awaiting: { fill: `color-mix(in oklab, ${GOLD_INK} 12%, transparent)`, border: `color-mix(in oklab, ${GOLD_INK} 30%, transparent)`, text: GOLD_INK },
  draft: { fill: SHEET, border: TEAL, text: TEAL, dashed: true },
  second_pending: { fill: `color-mix(in oklab, ${GOLD_INK} 12%, transparent)`, border: GOLD_INK, text: GOLD_INK, dashed: true },
  settle: { fill: `color-mix(in oklab, ${GARNET} 9%, transparent)`, border: `color-mix(in oklab, ${GARNET} 40%, transparent)`, text: GARNET },
  resub_needed: { fill: `color-mix(in oklab, ${GOLD_INK} 12%, transparent)`, border: `color-mix(in oklab, ${GOLD_INK} 30%, transparent)`, text: GOLD_INK },
  resub_in: { fill: `color-mix(in oklab, ${GOLD_INK} 12%, transparent)`, border: `color-mix(in oklab, ${GOLD_INK} 30%, transparent)`, text: GOLD_INK },
  pass: { fill: TEAL, border: TEAL, text: "oklch(96% 0.02 195)" },
  pass_resub: { fill: `color-mix(in oklab, ${TEAL} 14%, transparent)`, border: `color-mix(in oklab, ${TEAL} 35%, transparent)`, text: TEAL },
  fail_resub: { fill: `color-mix(in oklab, ${GARNET} 9%, transparent)`, border: GARNET, text: GARNET },
};

function chipLabel(cell: BoardCell, opensDay: number | null, dueDay: number | null): string {
  switch (cell.state) {
    case "locked":
      return opensDay ? `Opens D${opensDay}` : "Not open";
    case "writing":
      return dueDay ? `Writing · due D${dueDay}` : "Writing";
    case "awaiting":
      return cell.waitingDays === 0 ? "Awaiting marking · today" : `Awaiting marking · ${cell.waitingDays ?? 0}d`;
    case "draft":
      return "Draft marks";
    case "second_pending":
      return "2nd mark";
    case "settle":
      return "Settle · both marked";
    case "resub_needed":
      return dueDay ? `Resub needed · due D${dueDay}` : "Resub needed";
    case "resub_in":
      return cell.waitingDays === 0 ? "Resub in · today" : `Resub in · ${cell.waitingDays ?? 0}d`;
    case "pass":
      return "Pass";
    case "pass_resub":
      return "Pass on resub";
    case "fail_resub":
      return "Fail on resub";
  }
}

export default async function TrainerAssignmentsBoardPage() {
  const trainer = await requireRole("trainer");
  const supabase = await createClient();
  const courseId = trainer.course_id;

  if (!courseId) {
    return (
      <div className="sheet p-6">
        <p className="text-muted">No course open. Pick one from the course switcher first.</p>
      </div>
    );
  }

  const timeZone = (await getCachedCenter(trainer.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  const [{ data: course }, { data: trainees }, { data: assignmentRows }, progress, clock, criteriaByType] =
    await Promise.all([
      supabase.from("courses").select("name").eq("id", courseId).maybeSingle(),
      supabase.from("profiles").select("id, full_name, course_status").eq("course_id", courseId).eq("role", "trainee").order("full_name"),
      supabase.from("assignments").select("*").eq("course_id", courseId),
      computeCourseDayProgress(supabase, courseId),
      getCourseReleaseClock(supabase, courseId, today),
      getAllAssignmentCriteria(supabase, trainer.center_id),
    ]);

  // The active cohort is the denominator everywhere Cambridge counts.
  const active = (trainees ?? []).filter((t) => t.course_status !== "withdrawn");
  const activeIds = new Set(active.map((t) => t.id));
  const rows = (assignmentRows ?? []).filter((a) => activeIds.has(a.trainee_id));

  const tutorIds = [...new Set(rows.flatMap((a) => [a.marker_id, a.second_marker_id]).filter((x): x is string => Boolean(x)))];
  const { data: tutors } = tutorIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", tutorIds) : { data: null };
  const tutorName = new Map((tutors ?? []).map((t) => [t.id, t.full_name]));
  const initialsOf = (name: string | null | undefined) =>
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");

  // Columns: the four Cambridge assignments in RELEASE order off the
  // timetable, never the alphabet and never hard-coded (§1a). A Reflection
  // column appears only when somebody on the course actually has one set.
  const releaseOrder = [...ASSIGNMENT_ORDER].sort((a, b) => {
    const da = clock.releaseByType.get(a)?.day ?? 99;
    const db = clock.releaseByType.get(b)?.day ?? 99;
    return da - db;
  });
  const anyReflection = rows.some((a) => a.assignment_type === "Plagiarism Reflection");
  const columns: string[] = anyReflection ? [...releaseOrder, "Plagiarism Reflection"] : releaseOrder;

  const cellFor = (a: AssignmentRow): BoardCell =>
    boardCell(a, {
      today,
      releaseOpen: clock.isOpen(a.assignment_type),
      criterionKeys: (criteriaByType[a.assignment_type] ?? []).map((c) => c.key),
    });

  const byTrainee = new Map<string, Map<string, { assignment: AssignmentRow; cell: BoardCell }>>();
  const decorated: { assignment: AssignmentRow; cell: BoardCell }[] = [];
  for (const a of rows) {
    const cell = cellFor(a);
    decorated.push({ assignment: a, cell });
    const forTrainee = byTrainee.get(a.trainee_id) ?? new Map();
    forTrainee.set(a.assignment_type, { assignment: a, cell });
    byTrainee.set(a.trainee_id, forTrainee);
  }

  const traineeName = new Map(active.map((t) => [t.id, t.full_name]));
  const queue = buildQueue(
    decorated.map((d) => ({
      assignment: d.assignment,
      cell: d.cell,
      traineeName: traineeName.get(d.assignment.trainee_id) ?? "A candidate",
      title: ASSIGNMENT_INFO[d.assignment.assignment_type]?.title ?? d.assignment.assignment_type,
    })),
    trainer.id
  );

  const sample = buildSample(
    decorated.filter((d) => d.assignment.assignment_type !== "Plagiarism Reflection"),
    releaseOrder.map((t) => ({ type: t, title: ASSIGNMENT_INFO[t]?.title ?? t })),
    active.length
  );

  const toMark = decorated.filter((d) => d.cell.state === "awaiting" || d.cell.state === "resub_in").length;
  const secondMarks = decorated.filter((d) => d.cell.state === "second_pending").length;
  const toSettle = decorated.filter((d) => d.cell.state === "settle").length;

  const band = BAND.teal;
  const dayLine = progress ? `Day ${progress.currentDay} of ${progress.totalDays}` : "Not started";

  return (
    <TpSheet maxWidth={1320}>
      {/* ---------- band ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-6 rounded-t-[14px]" style={{ background: band.fill, padding: "18px 26px 16px" }}>
        <div className="flex min-w-0 flex-col gap-[3px]">
          <p className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: band.eyebrow }}>
            {[course?.name, dayLine, `${active.length} candidates`].filter(Boolean).join(" · ")}
          </p>
          <h2 className="font-serif" style={{ fontSize: 29, fontWeight: 400, color: "oklch(98.5% 0.006 90)", lineHeight: 1.15 }}>
            Assignments · marking
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HeadPill label={`${toMark} to mark`} on={toMark > 0} />
          <HeadPill label={`${secondMarks} second mark`} on={secondMarks > 0} />
          <HeadPill label={`${toSettle} to settle`} on={toSettle > 0} settle />
        </div>
      </div>

      {/* ---------- §1a timetable strip ---------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ background: CARD, borderBottom: `1px solid ${FAINT}`, padding: "13px 26px" }}>
        {releaseOrder.map((type) => {
          const release = clock.releaseByType.get(type);
          const open = clock.isOpen(type);
          const ofType = decorated.filter((d) => d.assignment.assignment_type === type);
          const closed = ofType.filter((d) => ["pass", "pass_resub", "fail_resub"].includes(d.cell.state)).length;
          const withTutors = ofType.filter((d) => ["awaiting", "draft", "second_pending", "settle", "resub_in"].includes(d.cell.state)).length;
          const writing = Math.max(0, ofType.length - closed - withTutors);
          // Deadlines can differ within one assignment (the demo's LRT is due
          // a day later for one TP group), so the strip names the first.
          const firstDue = ofType
            .map((d) => d.assignment.due_date)
            .filter((x): x is string => Boolean(x))
            .sort()[0];
          const dueDay = clock.dayOf(firstDue ?? null);
          return (
            <div
              key={type}
              style={{
                borderRadius: 10,
                border: `1px ${open ? "solid" : "dashed"} ${FAINT}`,
                background: SHEET,
                padding: "10px 13px 11px",
                opacity: open ? 1 : 0.75,
              }}
            >
              <p className="font-serif" style={{ fontSize: 16, fontWeight: 600, color: INK, lineHeight: 1.2 }}>
                {ASSIGNMENT_INFO[type]?.title ?? type}
              </p>
              <p className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: open ? TEAL : MUTED, marginTop: 3 }}>
                {!open
                  ? `Opens D${release?.day ?? "—"}`
                  : closed === ofType.length && ofType.length > 0
                    ? "Closed"
                    : withTutors > 0
                      ? "Marking"
                      : `Open · due D${dueDay ?? "—"}`}
              </p>
              <div className="mt-2 flex gap-[2px]" style={{ height: 6 }}>
                {closed > 0 ? <span style={{ flex: closed, borderRadius: 3, background: TEAL }} /> : null}
                {withTutors > 0 ? <span style={{ flex: withTutors, borderRadius: 3, background: GOLD_INK }} /> : null}
                {writing > 0 ? <span style={{ flex: writing, borderRadius: 3, background: FAINT }} /> : null}
              </div>
              <p style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>
                {closed} closed · {withTutors} with tutors · {writing} writing
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------- §1b the grid ---------- */}
        <div style={{ padding: "16px 20px 22px 26px" }}>
          <div className="overflow-x-auto">
            <div style={{ minWidth: 720 }}>
              <div
                className="grid items-end"
                style={{
                  gridTemplateColumns: `168px repeat(${columns.length}, minmax(0,1fr)) 84px`,
                  borderBottom: `1.5px solid ${TEAL}`,
                  paddingBottom: 6,
                }}
              >
                <span className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: MUTED }}>
                  Candidate
                </span>
                {columns.map((type) => (
                  <span
                    key={type}
                    className="font-bold uppercase"
                    style={{
                      fontSize: 10.5,
                      letterSpacing: "0.1em",
                      color: type === "Plagiarism Reflection" ? GARNET : MUTED,
                      paddingRight: 8,
                    }}
                  >
                    {SHORT[type] ?? type}
                  </span>
                ))}
                <span className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.1em", color: MUTED, textAlign: "right" }}>
                  Passed
                </span>
              </div>

              {active.map((t, i) => {
                const forTrainee = byTrainee.get(t.id);
                const passed = [...(forTrainee?.values() ?? [])].filter(
                  (c) => c.assignment.assignment_type !== "Plagiarism Reflection" && (c.cell.state === "pass" || c.cell.state === "pass_resub")
                ).length;
                const reflection = forTrainee?.get("Plagiarism Reflection");
                return (
                  <div
                    key={t.id}
                    className="grid items-center"
                    style={{
                      gridTemplateColumns: `168px repeat(${columns.length}, minmax(0,1fr)) 84px`,
                      borderBottom: `1px solid ${FAINT}`,
                      padding: "7px 0",
                      background: i % 2 ? ZEBRA : undefined,
                    }}
                  >
                    <div className="min-w-0 pr-3">
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{t.full_name}</p>
                      {reflection ? (
                        <p style={{ fontSize: 10.5, color: GARNET }}>Reflection set</p>
                      ) : null}
                    </div>
                    {columns.map((type) => {
                      const entry = forTrainee?.get(type);
                      if (!entry) {
                        return (
                          <span key={type} style={{ fontSize: 12, color: FAINT, paddingRight: 8 }}>
                            —
                          </span>
                        );
                      }
                      const { assignment: a, cell } = entry;
                      const look = CHIP[cell.state];
                      const opensDay = clock.releaseByType.get(type)?.day ?? null;
                      let label = chipLabel(cell, opensDay, clock.dayOf(a.due_date));
                      if (cell.state === "draft") label = `Draft marks · ${initialsOf(tutorName.get(a.marker_id ?? "")) || "?"}`;
                      if (cell.state === "second_pending") {
                        label =
                          a.second_marker_id === trainer.id
                            ? "Your 2nd mark"
                            : a.second_marker_id
                              ? `2nd mark · ${initialsOf(tutorName.get(a.second_marker_id))}`
                              : "2nd mark needed";
                      }
                      const sanction = type === "Plagiarism Reflection";
                      const chip = (
                        <span
                          className="inline-flex max-w-full items-center gap-1.5 truncate"
                          style={{
                            borderRadius: 6,
                            border: `1px ${look.dashed || sanction ? "dashed" : "solid"} ${sanction ? GARNET : look.border}`,
                            background: sanction ? `color-mix(in oklab, ${GARNET} 7%, transparent)` : look.fill,
                            color: sanction ? GARNET : look.text,
                            padding: "4px 9px",
                            fontSize: 11.5,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cell.inSample ? (
                            <span aria-hidden title="In the double-marked sample" style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", flexShrink: 0 }} />
                          ) : null}
                          <span className="truncate">{label}</span>
                        </span>
                      );
                      const openable = cell.state !== "locked" && cell.state !== "writing";
                      return (
                        <span key={type} className="min-w-0 pr-2">
                          {openable ? (
                            <Link href={`/portfolio/${t.id}/assignments/${a.id}`} className="trainee-hover inline-flex max-w-full">
                              {chip}
                            </Link>
                          ) : (
                            chip
                          )}
                        </span>
                      );
                    })}
                    <span
                      className="font-serif tabular-nums"
                      style={{ fontSize: 16, color: passed >= 3 ? TEAL : MUTED, textAlign: "right" }}
                    >
                      {passed} of 4
                    </span>
                  </div>
                );
              })}
              {active.length === 0 ? <p className="py-6 text-sm" style={{ color: MUTED }}>No candidates on this course yet.</p> : null}
            </div>
          </div>
        </div>

        {/* ---------- §1c the rail ---------- */}
        <div className="flex flex-col gap-5" style={{ background: CARD, borderLeft: `1px solid ${FAINT}`, padding: "18px 22px 24px" }}>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Marker colour={GOLD_INK} label="Your queue" />
              <span className="italic" style={{ fontSize: 11, color: MUTED }}>
                oldest first
              </span>
            </div>
            {queue.length === 0 ? (
              <p style={{ fontSize: 12.5, color: MUTED }}>Nothing is waiting on you.</p>
            ) : (
              queue.map((q) => {
                const hue = q.hue === "teal" ? TEAL : q.hue === "garnet" ? GARNET : GOLD_INK;
                return (
                  <Link
                    key={`${q.assignmentId}-${q.order}`}
                    href={`/portfolio/${q.traineeId}/assignments/${q.assignmentId}`}
                    className="trainee-hover flex items-center justify-between gap-3"
                    style={{ borderRadius: 10, border: `1px solid ${FAINT}`, borderLeft: `4px solid ${hue}`, background: SHEET, padding: "9px 12px" }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate" style={{ fontSize: 13, fontWeight: 600, color: INK }}>
                        {q.traineeName} · {q.assignmentTitle}
                      </span>
                      <span className="block" style={{ fontSize: 11, fontWeight: 600, color: hue }}>
                        {q.reason}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: hue, whiteSpace: "nowrap" }}>{q.action}</span>
                  </Link>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <Marker colour={TEAL} label="Double marking" />
              <span style={{ fontSize: 11, color: MUTED }}>
                {sample[0]?.required ? `${sample[0].required} of each · ${active.length} candidates` : `${active.length} candidates`}
              </span>
            </div>
            {sample.map((s) => {
              const required = s.required ?? 0;
              const full = required > 0 && s.settled >= required;
              return (
                <div key={s.assignmentType} style={{ borderRadius: 10, border: `1px solid ${FAINT}`, background: SHEET, padding: "9px 12px" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: INK }}>{s.title}</p>
                  <div className="mt-1.5 flex gap-[3px]">
                    {Array.from({ length: Math.max(required, 1) }).map((_, i) => {
                      const settled = i < s.settled;
                      const inProgress = !settled && i < s.settled + s.inProgress;
                      return (
                        <span
                          key={i}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: settled ? TEAL : inProgress ? `color-mix(in oklab, ${GOLD_INK} 25%, transparent)` : "transparent",
                            border: settled ? "none" : `1px dashed ${inProgress ? GOLD_INK : BORDER}`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 11, color: full ? TEAL : GOLD_INK, marginTop: 5, fontWeight: 600 }}>
                    {required > 0 ? `${s.settled} of ${required} settled` : `${s.settled} settled`}
                    {s.inProgress > 0 ? ` · ${s.inProgress} in progress` : ""}
                  </p>
                  <p style={{ fontSize: 11, color: s.failsOutsideSample > 0 ? GARNET : MUTED, marginTop: 2 }}>
                    {!s.anyFails
                      ? "No Not met yet"
                      : s.failsOutsideSample > 0
                        ? `${s.failsOutsideSample} Not met without a second mark — added automatically`
                        : "Every Not met included ✓"}
                  </p>
                </div>
              );
            })}
            <p style={{ fontSize: 11, lineHeight: 1.5, color: MUTED }}>
              Handbook 9.2.3: a proportion of each assignment must be double-marked — three of each up to nine candidates,
              four up to sixteen, five up to twenty-four — and the sample must include any fail assignments. Both tutors
              initial what they have checked, and the centre keeps the record.{" "}
              <Link href="/assessor/double-marking" className="underline" style={{ color: TEAL }}>
                The record the assessor sees
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </TpSheet>
  );
}

const SHORT: Record<string, string> = {
  "Focus on Learner": "Focus on the Learner",
  LRT: "Language Related Tasks",
  Skills: "Skills Related Task",
  LfC: "Lessons from the Classroom",
  "Plagiarism Reflection": "Reflection",
};

function HeadPill({ label, on, settle = false }: { label: string; on: boolean; settle?: boolean }) {
  return (
    <span
      className="flex items-center gap-1.5"
      style={{
        borderRadius: 999,
        background: on ? (settle ? "oklch(86% 0.09 82)" : "oklch(86% 0.06 195)") : "transparent",
        border: on ? "none" : `1px solid ${BAND.teal.eyebrow}`,
        color: on ? (settle ? "oklch(30% 0.042 58)" : "oklch(26% 0.05 195)") : BAND.teal.status,
        padding: "4px 11px",
        fontSize: 11.5,
        fontWeight: 600,
      }}
    >
      {settle && on ? <span style={{ width: 5, height: 5, borderRadius: 999, background: GARNET }} /> : null}
      {label}
    </span>
  );
}

function Marker({ colour, label }: { colour: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span style={{ width: 3, height: 13, borderRadius: 2, background: colour }} />
      <span className="font-bold uppercase" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: colour }}>
        {label}
      </span>
    </span>
  );
}
