import Link from "next/link";
import type { OwedLesson, TodaySession, TomorrowLine } from "@/lib/tp-queue";
import { AIM_TYPE_LABELS, AIM_TYPE_STYLE, type AimType } from "@/lib/aim-type";

// design_handoff_teaching_practice_v2: the owed lessons as cards, each
// showing what is already on the tutor's desk to write from; today's
// session as a timeline; tomorrow as one line. Presentational only --
// nothing here is editable, and the role colour comes from the hub's own
// --hub-accent (garnet MCT / gold ACT), never teal.

const RED = "oklch(45% 0.16 27)";
const AMBER = "oklch(44% 0.095 68)";

// The handoff's aim chip, in Connect's own aim palette rather than the
// design's four-bucket one: this app's taxonomy is seven aim types
// (grammar/lexis/function + the four skills), and aim-type.ts is their
// single source of truth -- including a deliberate colour audit that
// reserves gold for brand use. Same chip shape, existing hues.
function AimChip({ aim }: { aim: AimType | null }) {
  if (!aim) return null;
  const style = AIM_TYPE_STYLE[aim];
  return (
    <span className="rounded-[4px] px-1.5 py-[2px] text-[10px] font-bold whitespace-nowrap" style={{ background: style.bg, color: style.ink }}>
      {AIM_TYPE_LABELS[aim]}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ageLabel(hours: number): string {
  if (hours < 1) return "Just ended";
  if (hours < 24) return `${Math.round(hours)} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} · past same-day`;
}

/** One line of the "On your desk" block: a status square, a label, a value. */
function DeskRow({
  filled,
  label,
  value,
  tone,
}: {
  filled: "ink" | "accent" | "none";
  label: string;
  value: string;
  tone?: "amber" | "red";
}) {
  return (
    <div className="flex items-center gap-2.5 text-[11.5px]">
      <span
        className="flex size-4 shrink-0 items-center justify-center rounded-[3px] border text-[9px] font-bold text-primary-foreground"
        style={
          filled === "ink"
            ? { background: "var(--color-ink)", borderColor: "var(--color-ink)" }
            : filled === "accent"
              ? { background: "color-mix(in oklab, var(--hub-accent) 40%, transparent)", borderColor: "var(--hub-accent)" }
              : { background: "transparent", borderColor: "var(--color-border)" }
        }
      >
        {filled === "ink" ? "✓" : ""}
      </span>
      <span className="w-[118px] shrink-0 text-muted">{label}</span>
      <span className="min-w-0 truncate font-medium" style={{ color: tone === "red" ? RED : tone === "amber" ? AMBER : "var(--color-ink)" }}>
        {value}
      </span>
    </div>
  );
}

export function OwedCard({ lesson }: { lesson: OwedLesson }) {
  const edge = lesson.isLate ? RED : "var(--hub-accent)";
  const dateLabel = new Date(`${lesson.taughtDate}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }).toUpperCase();
  const meta = [lesson.point.level, lesson.slotIndex ? `slot ${lesson.slotIndex}` : null, lesson.slotTime].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col overflow-hidden rounded-[6px] border border-border bg-card transition-colors" style={{ boxShadow: `inset 0 3px 0 ${edge}` }}>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
            TP{lesson.tpNumber} · {dateLabel}
          </span>
          <span
            className="inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-bold whitespace-nowrap"
            style={
              lesson.isLate
                ? { background: "oklch(94% 0.043 25)", color: RED }
                : { background: "color-mix(in oklab, var(--hub-accent) 16%, var(--color-card))", color: "var(--hub-accent-deep)" }
            }
          >
            {ageLabel(lesson.ageHours)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-card-inset font-serif text-[13px] font-semibold text-ink-warm">
            {initials(lesson.traineeName)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-serif text-[20px] leading-tight font-semibold text-ink-warm">{lesson.traineeName}</span>
            <span className="truncate text-[11px] text-muted">
              {lesson.groupName} · {lesson.yours ? "yours" : (lesson.tutorName ?? "another tutor")}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-ink">{lesson.point.title}</span>
          <span className="flex flex-wrap items-center gap-2">
            <AimChip aim={lesson.point.aimType} />
            {meta ? <span className="text-[11px] text-muted">{meta}</span> : null}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-3" style={{ background: "color-mix(in oklab, var(--hub-accent) 6%, transparent)" }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-bold tracking-[0.08em] text-muted uppercase">On your desk</span>
          <span className="text-[10px] text-muted">fills in by itself</span>
        </div>
        <DeskRow
          filled={lesson.notes.count > 0 ? "ink" : "none"}
          label={lesson.yours ? "Your observation notes" : "Tutor's notes"}
          value={lesson.notes.count > 0 ? `${lesson.notes.count} notes${lesson.notes.criteria.length ? ` · ${lesson.notes.criteria.join(" ")}` : ""}` : "None captured in the lesson"}
          tone={lesson.notes.count > 0 ? undefined : "red"}
        />
        <DeskRow
          filled={lesson.selfEval.receivedAt ? "ink" : "none"}
          label="Self-evaluation"
          value={
            lesson.selfEval.receivedAt
              ? `In · ${new Date(lesson.selfEval.receivedAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })} ${new Date(lesson.selfEval.receivedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
              : "Not yet · due 22:00 tonight"
          }
          tone={lesson.selfEval.receivedAt ? undefined : "amber"}
        />
        <DeskRow
          filled={lesson.draft ? "accent" : "none"}
          label="Your draft"
          value={lesson.draft ? `${lesson.draft.points} points, ${lesson.draft.criteriaTagged} criteria tagged` : "Not started"}
          tone={lesson.draft ? "amber" : undefined}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border-faint px-4 py-3">
        <span className="min-w-0 truncate text-[11px]" style={{ color: lesson.standingFlag ? RED : "var(--color-muted)" }}>
          {lesson.standingFlag ?? (lesson.selfEval.receivedAt ? "Everything is in" : "Can start now; release waits for the self-eval")}
        </span>
        <Link
          href={`/portfolio/${lesson.traineeId}/tp/${lesson.tpNumber}`}
          className="inline-flex h-8 shrink-0 items-center rounded-[6px] px-3.5 text-[12px] font-semibold text-primary-foreground transition-[filter] hover:brightness-110"
          style={{ background: "var(--hub-accent-deep)" }}
        >
          {lesson.draft ? "Continue draft" : "Write feedback"}
        </Link>
      </div>
    </div>
  );
}

export function TodayCard({ today, tomorrow }: { today: TodaySession | null; tomorrow: TomorrowLine | null }) {
  if (!today && !tomorrow) return null;
  const liveIndex = today ? today.slots.findIndex((s) => s.state === "now") : -1;
  const lastIndex = today ? today.slots.length : 0; // the feedback session is the final stop
  const progress = today && lastIndex > 0 ? ((liveIndex >= 0 ? liveIndex : today.slots.filter((s) => s.state === "taught").length) / lastIndex) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 rounded-[6px] border border-border bg-card px-4 pt-4 pb-4">
      {today ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: "var(--hub-accent)" }}>
                Today
              </span>
              <span className="text-[13px] font-semibold text-ink">
                {new Date(`${today.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })} · TP{today.tpNumber} · {today.groupName}
                {today.level ? ` · ${today.level}` : ""}
                {today.room ? ` · ${today.room}` : ""}
              </span>
            </span>
            <span className="text-[12px] text-muted">
              {today.observerNames.length > 0 ? `Observing: ${today.observerNames.join(", ")}` : "No peer observers"}
              {today.peerTaskCriteria.length > 0 ? ` · peer task ${today.peerTaskCriteria.join(" ")}` : ""}
              {today.feedbackSessionAt ? ` · feedback session ${today.feedbackSessionAt}` : ""}
            </span>
          </div>

          <div className="relative">
            <span className="absolute top-[7px] right-0 left-0 block h-0.5 rounded-full bg-border" />
            <span className="absolute top-[7px] left-0 block h-0.5 rounded-full" style={{ width: `${progress}%`, background: "var(--hub-accent)" }} />
            <div className="relative grid gap-3" style={{ gridTemplateColumns: `repeat(${today.slots.length + 1}, minmax(0, 1fr))` }}>
              {today.slots.map((s) => (
                <div key={s.traineeId} className="flex flex-col gap-1.5">
                  <span
                    className="block size-4 rounded-full border-2 border-card"
                    style={{ background: s.state === "taught" ? "var(--color-ink)" : s.state === "now" ? "var(--hub-accent)" : "var(--color-card)", boxShadow: s.state === "next" ? "inset 0 0 0 1.5px var(--color-border)" : undefined }}
                  />
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: s.state === "now" ? "var(--hub-accent)" : "var(--color-ink)" }}>
                      {s.start ?? "--"}
                    </span>
                    <span className="text-[10px] tracking-[0.06em] text-muted uppercase">{s.state === "now" ? "teaching now" : s.state}</span>
                  </span>
                  <span className="truncate text-[13px] font-semibold text-ink">{s.traineeName}</span>
                  <span className="truncate text-[12px] text-muted">{s.point.title}</span>
                  <span className="truncate text-[11px]" style={{ color: s.liveNotesCount > 0 && s.state === "now" ? "var(--hub-accent)" : "var(--color-muted)" }}>
                    {s.inQueue
                      ? "In the queue above"
                      : s.state === "now"
                        ? `Your notes: ${s.liveNotesCount} so far`
                        : s.selfEvalDueAt
                          ? `Self-eval due ${s.selfEvalDueAt}`
                          : "Self-eval in"}
                  </span>
                </div>
              ))}
              <div className="flex flex-col gap-1.5">
                <span className="block size-4 rounded-full border-2 border-card bg-card shadow-[inset_0_0_0_1.5px_var(--color-border)]" />
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[12px] font-bold tabular-nums text-ink">{today.feedbackSessionAt ?? "--"}</span>
                  <span className="text-[10px] tracking-[0.06em] text-muted uppercase">next</span>
                </span>
                <span className="truncate text-[13px] font-semibold text-ink">Feedback session</span>
                <span className="truncate text-[12px] text-muted">All three{today.room ? `, ${today.room}` : ""}</span>
                <span className="truncate text-[11px] text-muted">Reveal peer notes after</span>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {tomorrow ? (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${today ? "border-t border-border-faint pt-3" : ""}`}>
          <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">Tomorrow</span>
          <span className="text-[12px] text-ink">
            {new Date(`${tomorrow.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })} · TP{tomorrow.tpNumber} · {tomorrow.groupName}
            {tomorrow.level ? ` · ${tomorrow.level}` : ""}
            {tomorrow.tutorName ? ` · ${tomorrow.tutorName}` : ""}
          </span>
          {tomorrow.slots.map((s) => (
            <span key={s.traineeName} className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className="block size-1.5 rounded-full" style={{ background: s.planSubmitted ? "var(--color-ink)" : AMBER }} />
              {s.start ? `${s.start} ` : ""}
              {s.traineeName} · {s.planSubmitted ? "plan in" : `no plan yet, due ${s.planDueAt}`}
            </span>
          ))}
          <span className="ml-auto text-[11px] text-muted">Same-day rule and slot lengths are centre settings.</span>
        </div>
      ) : null}
    </div>
  );
}
