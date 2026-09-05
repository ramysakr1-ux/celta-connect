import { distinctTpDates, halfTpDates, rotationPosition, type TpTimetableEvent } from "@/lib/rotation";
import type { AimType } from "@/lib/aim-type";

// design_handoff_teaching_practice_v2 (Ramy, 6 Sep 2026). The tab answers
// one question -- "which lessons do I owe written feedback on" -- so the
// old three-bucket row list becomes: owed cards (each showing what is
// already on the tutor's desk to write from), today's session as a
// timeline, tomorrow as one line. Supersedes tp-marking-queue.ts.
//
// Everything here is derived; nothing on the tab is entered.

export interface QueuePoint {
  title: string;
  aimType: AimType | null;
  level: string | null;
}

export interface OwedLesson {
  traineeId: string;
  traineeName: string;
  tpNumber: number;
  groupName: string;
  tutorName: string | null;
  /** The viewer is the tutor of this candidate's group. */
  yours: boolean;
  point: QueuePoint;
  slotIndex: number | null;
  slotTime: string | null;
  taughtDate: string;
  ageHours: number;
  isLate: boolean;
  /** The tutor's own live capture notes for this lesson. */
  notes: { count: number; criteria: string[] };
  selfEval: { receivedAt: string | null; dueAt: string | null };
  /** An unpublished tp_feedback row -- points written, criteria tagged. */
  draft: { points: number; criteriaTagged: number } | null;
  /** Roster-side warning worth seeing before writing, else null. */
  standingFlag: string | null;
}

export interface TodaySlot {
  start: string | null;
  traineeId: string;
  traineeName: string;
  point: QueuePoint;
  state: "taught" | "now" | "next";
  liveNotesCount: number;
  selfEvalDueAt: string | null;
  /** Already sitting in the owed grid above. */
  inQueue: boolean;
}

export interface TodaySession {
  date: string;
  tpNumber: number;
  groupName: string;
  level: string | null;
  room: string | null;
  observerNames: string[];
  peerTaskCriteria: string[];
  feedbackSessionAt: string | null;
  slots: TodaySlot[];
}

export interface TomorrowSlot {
  start: string | null;
  traineeName: string;
  planSubmitted: boolean;
  planDueAt: string | null;
}

export interface TomorrowLine {
  date: string;
  tpNumber: number;
  groupName: string;
  level: string | null;
  tutorName: string | null;
  slots: TomorrowSlot[];
}

export interface TpQueue {
  owed: OwedLesson[];
  /** Other tutors' owed lessons -- MCT only, behind Show. */
  othersOwed: OwedLesson[];
  today: TodaySession | null;
  tomorrow: TomorrowLine | null;
}

export interface QueueMember {
  traineeId: string;
  fullName: string;
  baseSlot: number;
}

export interface QueueGroup {
  subgroupId: string;
  tpGroupId: string | null;
  groupName: string;
  halfOrder: 1 | 2 | null;
  tutorProfileId: string | null;
  tutorName: string | null;
  members: QueueMember[];
}

export interface QueuePlan {
  trainee_id: string;
  tp_number: number;
  taught_at: string | null;
  main_lesson_aim: string;
  short_title: string | null;
  aim_type: AimType | null;
  level: string | null;
}

export interface QueueFeedback {
  trainee_id: string;
  tp_number: number;
  submitted_at: string | null;
  grade: string | null;
  pointCount: number;
  criteriaCount: number;
}

export interface QueueNote {
  trainee_id: string;
  tp_number: number;
  criteria_codes: string[];
  /** Who captured it -- a lesson's notes are its own tutor's. */
  trainer_id: string;
}

export interface QueueSelfEval {
  trainee_id: string;
  tp_number: number;
  submitted_at: string | null;
}

export interface QueueEvent {
  id: string;
  event_date: string;
  event_time: string | null;
  detail: string | null;
  type: string;
  title: string | null;
}

function pointOf(plan: QueuePlan | undefined): QueuePoint {
  return {
    title: plan ? plan.short_title || plan.main_lesson_aim : "Point not set",
    aimType: plan?.aim_type ?? null,
    level: plan?.level ?? null,
  };
}

export function buildTpQueue(input: {
  groups: QueueGroup[];
  plans: QueuePlan[];
  feedback: QueueFeedback[];
  notes: QueueNote[];
  selfEvals: QueueSelfEval[];
  events: QueueEvent[];
  viewerId: string;
  /** MCT sees other tutors' owed lessons behind Show; an ACT never does. */
  seesAllGroups: boolean;
  today: string;
  now: Date;
  sameDayHours: number;
  /** Criteria the peer observers are watching for on today's TP. */
  peerTaskCriteria?: string[];
}): TpQueue {
  const { groups, plans, feedback, notes, selfEvals, events, viewerId, seesAllGroups, today, now, sameDayHours } = input;

  const groupOfTrainee = new Map<string, QueueGroup>();
  const nameOfTrainee = new Map<string, string>();
  for (const g of groups) {
    for (const m of g.members) {
      groupOfTrainee.set(m.traineeId, g);
      nameOfTrainee.set(m.traineeId, m.fullName);
    }
  }
  const planBy = new Map(plans.map((p) => [`${p.trainee_id}-${p.tp_number}`, p]));
  const feedbackBy = new Map(feedback.map((f) => [`${f.trainee_id}-${f.tp_number}`, f]));
  const selfEvalBy = new Map(selfEvals.map((s) => [`${s.trainee_id}-${s.tp_number}`, s]));
  // Keyed by lesson AND author: the card shows the notes taken by the
  // tutor who owes the feedback, which is not the viewer when an MCT is
  // looking at another tutor's card.
  const notesBy = new Map<string, QueueNote[]>();
  for (const n of notes) {
    const key = `${n.trainee_id}-${n.tp_number}-${n.trainer_id}`;
    notesBy.set(key, [...(notesBy.get(key) ?? []), n]);
  }

  // "NS at TP2 · at risk" -- the one roster-side fact worth seeing before
  // writing. Cheap: the candidate's most recent not-to-standard grade.
  const lastNsByTrainee = new Map<string, number>();
  for (const f of feedback) {
    if (f.submitted_at && f.grade === "not_to_standard") {
      const prev = lastNsByTrainee.get(f.trainee_id);
      if (prev === undefined || f.tp_number > prev) lastNsByTrainee.set(f.trainee_id, f.tp_number);
    }
  }

  const tpEvents = events.filter((e) => e.type === "tp");
  const eventsByDate = new Map<string, QueueEvent[]>();
  for (const e of tpEvents) {
    eventsByDate.set(e.event_date, [...(eventsByDate.get(e.event_date) ?? []), e]);
  }
  for (const list of eventsByDate.values()) list.sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));

  // ---- owed ----------------------------------------------------------
  const owedAll: OwedLesson[] = [];
  for (const p of plans) {
    if (!p.taught_at) continue;
    const key = `${p.trainee_id}-${p.tp_number}`;
    const fb = feedbackBy.get(key);
    if (fb?.submitted_at) continue; // published -- drops off

    const group = groupOfTrainee.get(p.trainee_id);
    const taughtDate = p.taught_at.slice(0, 10);
    const dayEvents = eventsByDate.get(taughtDate) ?? [];
    // Which slot of that day this candidate taught, by rotation position.
    const slotIndex =
      group && group.halfOrder
        ? rotationPosition(group.members.find((m) => m.traineeId === p.trainee_id)?.baseSlot ?? 0, group.members.length, p.tp_number) + 1
        : null;
    const slotEvent = slotIndex ? dayEvents[slotIndex - 1] : dayEvents[0];
    const slotTime = slotEvent?.event_time?.slice(0, 5) ?? null;

    // Age from the slot's end, or from the taught date when no clock time
    // is on the timetable (an honest floor, never a negative age).
    const endedAt = slotTime ? new Date(`${taughtDate}T${slotTime}:00`) : new Date(`${taughtDate}T23:59:00`);
    const ageHours = Math.max(0, (now.getTime() - endedAt.getTime()) / 3_600_000);

    const noteAuthor = group?.tutorProfileId ?? viewerId;
    const lessonNotes = notesBy.get(`${key}-${noteAuthor}`) ?? [];
    const criteria = [...new Set(lessonNotes.flatMap((n) => n.criteria_codes))].sort();
    const selfEval = selfEvalBy.get(key);
    const lastNs = lastNsByTrainee.get(p.trainee_id);

    owedAll.push({
      traineeId: p.trainee_id,
      traineeName: nameOfTrainee.get(p.trainee_id) ?? "Unknown",
      tpNumber: p.tp_number,
      groupName: group?.groupName ?? "No group",
      tutorName: group?.tutorName ?? null,
      yours: !group?.tutorProfileId || group.tutorProfileId === viewerId,
      point: pointOf(p),
      slotIndex,
      slotTime,
      taughtDate,
      ageHours,
      isLate: ageHours > sameDayHours,
      notes: { count: lessonNotes.length, criteria },
      selfEval: { receivedAt: selfEval?.submitted_at ?? null, dueAt: selfEval?.submitted_at ? null : `${taughtDate}T22:00` },
      draft: fb && (fb.pointCount > 0 || fb.criteriaCount > 0) ? { points: fb.pointCount, criteriaTagged: fb.criteriaCount } : null,
      // Worth seeing before writing: an earlier lesson graded not to
      // standard. Same TP or later is not a warning about this one.
      standingFlag: lastNs !== undefined && lastNs < p.tp_number ? `NS at TP${lastNs} · at risk` : null,
    });
  }
  owedAll.sort((a, b) => b.ageHours - a.ageHours);

  const owed = owedAll.filter((l) => l.yours);
  const othersOwed = seesAllGroups ? owedAll.filter((l) => !l.yours) : [];

  // ---- today ---------------------------------------------------------
  const tpTimetable: TpTimetableEvent[] = tpEvents.map((e) => ({ event_date: e.event_date }));
  const allTpDates = distinctTpDates(tpTimetable);
  const covered = groups.filter((g) => seesAllGroups || !g.tutorProfileId || g.tutorProfileId === viewerId);
  const nowClock = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  let todaySession: TodaySession | null = null;
  let tomorrowLine: TomorrowLine | null = null;

  for (const g of covered) {
    if (!g.halfOrder) continue;
    const dates = halfTpDates(tpTimetable, g.halfOrder);
    const idxToday = dates.indexOf(today);
    const tpNumber = idxToday >= 0 ? idxToday + 1 : -1;
    if (idxToday >= 0 && tpNumber >= 1 && !todaySession) {
      const dayEvents = eventsByDate.get(today) ?? [];
      const ordered = [...g.members].sort(
        (a, b) => rotationPosition(a.baseSlot, g.members.length, tpNumber) - rotationPosition(b.baseSlot, g.members.length, tpNumber)
      );
      const slots: TodaySlot[] = ordered.map((m, i) => {
        const ev = dayEvents[i];
        const start = ev?.event_time?.slice(0, 5) ?? null;
        const nextStart = dayEvents[i + 1]?.event_time?.slice(0, 5) ?? null;
        const plan = planBy.get(`${m.traineeId}-${tpNumber}`);
        const taught = Boolean(plan?.taught_at);
        const state: TodaySlot["state"] = taught ? "taught" : start && nowClock >= start && (!nextStart || nowClock < nextStart) ? "now" : "next";
        const key = `${m.traineeId}-${tpNumber}`;
        return {
          start,
          traineeId: m.traineeId,
          traineeName: m.fullName,
          point: pointOf(plan),
          state,
          liveNotesCount: (notesBy.get(`${key}-${g.tutorProfileId ?? viewerId}`) ?? []).length,
          selfEvalDueAt: selfEvalBy.get(key)?.submitted_at ? null : "22:00",
          inQueue: owedAll.some((o) => o.traineeId === m.traineeId && o.tpNumber === tpNumber),
        };
      });
      // The feedback session that closes the day, from the timetable's own
      // convention (timetable-skeleton.ts titles it "Feedback").
      const feedbackEvent = events.find((e) => e.event_date === today && (e.title ?? "").toLowerCase().startsWith("feedback"));
      const otherHalf = groups.find((x) => x.tpGroupId && x.tpGroupId === g.tpGroupId && x.subgroupId !== g.subgroupId);
      todaySession = {
        date: today,
        tpNumber,
        groupName: g.groupName,
        level: pointOf(planBy.get(`${ordered[0]?.traineeId}-${tpNumber}`)).level,
        room: dayEvents[0]?.detail ?? null,
        observerNames: (otherHalf?.members ?? []).map((m) => m.fullName),
        peerTaskCriteria: input.peerTaskCriteria ?? [],
        feedbackSessionAt: feedbackEvent?.event_time?.slice(0, 5) ?? null,
        slots,
      };
    }

    // Tomorrow = this group's next teaching day after today.
    const nextDate = dates.find((d) => d > today);
    if (nextDate && !tomorrowLine) {
      const idx = dates.indexOf(nextDate);
      const tpNext = idx + 1;
      const ordered = [...g.members].sort(
        (a, b) => rotationPosition(a.baseSlot, g.members.length, tpNext) - rotationPosition(b.baseSlot, g.members.length, tpNext)
      );
      const dayEvents = eventsByDate.get(nextDate) ?? [];
      tomorrowLine = {
        date: nextDate,
        tpNumber: tpNext,
        groupName: g.groupName,
        level: pointOf(planBy.get(`${ordered[0]?.traineeId}-${tpNext}`)).level,
        tutorName: g.tutorName,
        slots: ordered.map((m, i) => {
          const plan = planBy.get(`${m.traineeId}-${tpNext}`);
          return {
            start: dayEvents[i]?.event_time?.slice(0, 5) ?? null,
            traineeName: m.fullName,
            planSubmitted: Boolean(plan),
            planDueAt: "09:00",
          };
        }),
      };
    }
  }

  // Fallback: no half-based group teaches today, but TP dates exist -- the
  // tab still shows nothing rather than guessing a session.
  void allTpDates;

  return { owed, othersOwed, today: todaySession, tomorrow: tomorrowLine };
}
