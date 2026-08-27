import { distinctTpDates, halfTpDates, rotationPosition, type TpTimetableEvent } from "@/lib/rotation";
import { isEventLive, type TimetableEvent } from "@/lib/timetable-grid";

export type QueueStatus = "feedback_due" | "teaching_now" | "planned";

export interface QueueRow {
  traineeId: string;
  traineeName: string;
  tpNumber: number;
  status: QueueStatus;
  topic: string;
  when: string;
}

interface Member {
  traineeId: string;
  fullName: string;
  baseSlot: number;
}

interface Subgroup {
  id: string;
  tpGroupId: string | null;
  halfOrder: 1 | 2 | null;
  members: Member[];
}

interface PlanAssignment {
  trainee_id: string;
  tp_number: number;
  taught_at: string | null;
  main_lesson_aim: string;
  short_title: string | null;
}

interface FeedbackRow {
  trainee_id: string;
  tp_number: number;
  submitted_at: string | null;
}

function formatEventWhen(event: TimetableEvent | undefined): string {
  if (!event) return "date not yet scheduled";
  return event.event_time ? `${event.event_date} ${event.event_time.slice(0, 5)}` : event.event_date;
}

// for-claude-code-trainer-remaining-screens.md's "Teaching Practice — the
// marking queue" (supersedes the 6 Aug 2026 two-card TP tab decision, per
// Ramy's follow-up: "this list/queue layout is what stands"). One row per
// lesson needing action, three states:
//  - feedback_due: taught, no feedback submitted yet.
//  - teaching_now: this half's next TP day is today and a live timetable
//    event is currently on -- only the single not-yet-taught member with
//    the lowest rotation position (i.e. genuinely up next) gets this state,
//    since the app has no finer-grained per-trainee timing within a block.
//  - planned: assigned and scheduled, not yet taught, not currently live.
// Unpaired subgroups (no tp_group_id/half_order -- rotation.ts's alternating
// -halves system doesn't apply to them) fall back to a plain "planned" row
// with no real date, same honest fallback rotation/page.tsx already uses.
export function buildMarkingQueue(input: {
  subgroups: Subgroup[];
  plans: PlanAssignment[];
  feedback: FeedbackRow[];
  tpEvents: TimetableEvent[];
  today: string;
  now: Date;
  timeZone: string;
}): QueueRow[] {
  const { subgroups, plans, feedback, tpEvents, today, now, timeZone } = input;
  const rows: QueueRow[] = [];
  const nameByTraineeId = new Map<string, string>();
  for (const g of subgroups) for (const m of g.members) nameByTraineeId.set(m.traineeId, m.fullName);

  const planByKey = new Map(plans.map((p) => [`${p.trainee_id}-${p.tp_number}`, p]));
  const feedbackGiven = new Set(
    feedback.filter((f) => f.submitted_at).map((f) => `${f.trainee_id}-${f.tp_number}`)
  );
  const eventsByDate = new Map<string, TimetableEvent[]>();
  for (const e of tpEvents) {
    const list = eventsByDate.get(e.event_date) ?? [];
    list.push(e);
    eventsByDate.set(e.event_date, list);
  }

  // Feedback due -- taught, unfed-back. Doesn't need the half/date machinery
  // below at all, just the plan + feedback rows directly.
  for (const p of plans) {
    if (!p.taught_at) continue;
    if (feedbackGiven.has(`${p.trainee_id}-${p.tp_number}`)) continue;
    rows.push({
      traineeId: p.trainee_id,
      traineeName: nameByTraineeId.get(p.trainee_id) ?? "Unknown",
      tpNumber: p.tp_number,
      status: "feedback_due",
      topic: p.short_title || p.main_lesson_aim,
      when: p.taught_at.slice(0, 10),
    });
  }

  // Not-yet-taught, paired subgroups: derive each half's next TP number
  // from the real timetable (rotation.ts's own bridge from "a calendar
  // date" to "this half's internal round count").
  const halvesByTpGroup = new Map<string, Subgroup[]>();
  for (const g of subgroups) {
    if (!g.tpGroupId || !g.halfOrder) continue;
    const list = halvesByTpGroup.get(g.tpGroupId) ?? [];
    list.push(g);
    halvesByTpGroup.set(g.tpGroupId, list);
  }

  const tpTimetableEvents: TpTimetableEvent[] = tpEvents.map((e) => ({ event_date: e.event_date }));
  const allDates = distinctTpDates(tpTimetableEvents);

  for (const halves of halvesByTpGroup.values()) {
    for (const half of halves) {
      if (!half.halfOrder) continue;
      const halfDates = halfTpDates(tpTimetableEvents, half.halfOrder);
      const nextDateIndex = halfDates.findIndex((d) => d >= today);
      if (nextDateIndex === -1) continue;
      const nextDate = halfDates[nextDateIndex];
      const tpNumber = nextDateIndex + 1;
      if (tpNumber < 1 || tpNumber > 6) continue; // TP7/8 self-select, outside this system

      const notYetTaught = half.members
        .filter((m) => {
          const plan = planByKey.get(`${m.traineeId}-${tpNumber}`);
          return plan && !plan.taught_at;
        })
        .sort((a, b) => rotationPosition(a.baseSlot, half.members.length, tpNumber) - rotationPosition(b.baseSlot, half.members.length, tpNumber));
      if (notYetTaught.length === 0) continue;

      const dayEvents = eventsByDate.get(nextDate) ?? [];
      const liveEvent = nextDate === today ? dayEvents.find((e) => e.type === "tp" && isEventLive(e, now, timeZone)) : undefined;
      const when = formatEventWhen(dayEvents.find((e) => e.type === "tp") ?? dayEvents[0]);

      notYetTaught.forEach((member, i) => {
        const plan = planByKey.get(`${member.traineeId}-${tpNumber}`)!;
        rows.push({
          traineeId: member.traineeId,
          traineeName: member.fullName,
          tpNumber,
          status: liveEvent && i === 0 ? "teaching_now" : "planned",
          topic: plan.short_title || plan.main_lesson_aim,
          when,
        });
      });
    }
  }

  // Unpaired subgroups: no half/date system applies (rotation/page.tsx's
  // own fallback) -- any not-yet-taught assigned plan is just "planned",
  // no real date to show.
  for (const g of subgroups) {
    if (g.tpGroupId) continue;
    for (const m of g.members) {
      for (const p of plans) {
        if (p.trainee_id !== m.traineeId || p.taught_at) continue;
        if (rows.some((r) => r.traineeId === p.trainee_id && r.tpNumber === p.tp_number)) continue;
        rows.push({
          traineeId: p.trainee_id,
          traineeName: m.fullName,
          tpNumber: p.tp_number,
          status: "planned",
          topic: p.short_title || p.main_lesson_aim,
          when: "date not yet scheduled",
        });
      }
    }
  }

  const order: Record<QueueStatus, number> = { feedback_due: 0, teaching_now: 1, planned: 2 };
  return rows.sort((a, b) => order[a.status] - order[b.status] || a.traineeName.localeCompare(b.traineeName));
}

// "Your groups" panel -- meeting-day pattern derived the same honest way as
// the queue above: the real weekdays a half's TP dates fall on. Subgroup-
// to-tutor ownership doesn't exist as a concept in this schema yet (only
// course_tutors, which links a profile to a whole COURSE, not a subgroup),
// so "your groups" here means every group on this course, same as
// rotation/page.tsx already shows without per-tutor filtering.
export function meetingDaysLabel(tpEvents: TimetableEvent[], halfOrder: 1 | 2 | null): string {
  if (!halfOrder) return "Not yet paired to a TP day pattern";
  const dates = halfTpDates(
    tpEvents.map((e) => ({ event_date: e.event_date })),
    halfOrder
  );
  if (dates.length === 0) return "No TP days scheduled yet";
  const weekdays = [
    ...new Set(dates.map((d) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }))),
  ];
  return weekdays.join(", ");
}
