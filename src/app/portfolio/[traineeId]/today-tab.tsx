import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { toLocalIso } from "@/lib/timetable-grid";
import { computeWeekOf } from "@/lib/course-progress";
import { rotationPosition, halfTpDates, type TpTimetableEvent } from "@/lib/rotation";
import { getTpCardStatus } from "@/lib/tp-plan-content";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";

const TP_LESSON_LENGTH_MINUTES = 45;
// Matches celta5/page.tsx's own local OBSERVATION_HOURS_REQUIRED -- kept as
// a separate constant rather than a shared import to avoid pulling that
// large staff/trainee-shared page's whole module graph into this one just
// for a single fixed CELTA number.
const OBSERVATION_HOURS_REQUIRED = 6;

interface WaitingItem {
  label: string;
  detail: string;
  href: string;
}

// for-claude-code-trainee-interface.md's Today tab -- the new landing
// experience for a real trainee viewing their OWN portfolio (or, via the
// peer-observation carve-out in layout.tsx, a groupmate's). Staff/assessor
// keep the existing Course Stream content in page.tsx -- this is a
// deliberately separate component/fetch, not woven into that page's
// already-substantial staff-facing logic.
export async function TodayTab({
  supabase,
  traineeId,
  courseId,
  courseName,
}: {
  supabase: SupabaseClient<Database>;
  traineeId: string;
  courseId: string;
  courseName: string | null;
}) {
  const today = toLocalIso(new Date());

  const [
    { data: course },
    { data: plans },
    { data: tpPlans },
    { data: selfEvaluations },
    { data: feedbackRows },
    { data: assignments },
    { data: subgroupMember },
    { data: observations },
  ] = await Promise.all([
    supabase.from("courses").select("start_date, end_date").eq("id", courseId).maybeSingle(),
    supabase.from("plan_assignments").select("*").eq("trainee_id", traineeId),
    supabase.from("tp_plans").select("tp_number, submitted_at").eq("trainee_id", traineeId),
    supabase.from("tp_self_evaluations").select("tp_number, submitted_at").eq("trainee_id", traineeId),
    supabase.from("tp_feedback").select("tp_number, grade, submitted_at").eq("trainee_id", traineeId),
    supabase.from("assignments").select("id, assignment_type, first_status, due_date").eq("trainee_id", traineeId),
    supabase.from("course_subgroup_members").select("subgroup_id, base_slot").eq("trainee_id", traineeId).maybeSingle(),
    supabase.from("observations").select("length_minutes, filmed").eq("trainee_id", traineeId),
  ]);

  // course_broadcasts carries three scope columns (visible_to_trainee_id/
  // _tp_group_id/_subgroup_id) that the write side already sets correctly
  // (personal assignment feedback, Stage 2's per-group nudge, rotation's
  // per-subgroup TP-release message) -- this filter is what makes those
  // writes actually private instead of every trainee seeing every
  // broadcast regardless of who it was meant for. Null in all three columns
  // = whole-cohort, the only case that needed no filter before this existed.
  const subgroupRow = subgroupMember
    ? (await supabase.from("course_subgroups").select("half_order, tp_group_id").eq("id", subgroupMember.subgroup_id).maybeSingle())
        .data
    : null;
  const subgroupTpGroupId = subgroupRow?.tp_group_id ?? null;
  let broadcastsQuery = supabase
    .from("course_broadcasts")
    .select("id, title, body, pinned, created_at, author_id")
    .eq("course_id", courseId)
    .not("sent_at", "is", null);
  const scopeFilters = [
    "and(visible_to_trainee_id.is.null,visible_to_tp_group_id.is.null,visible_to_subgroup_id.is.null)",
    `visible_to_trainee_id.eq.${traineeId}`,
  ];
  if (subgroupTpGroupId) scopeFilters.push(`visible_to_tp_group_id.eq.${subgroupTpGroupId}`);
  if (subgroupMember) scopeFilters.push(`visible_to_subgroup_id.eq.${subgroupMember.subgroup_id}`);
  broadcastsQuery = broadcastsQuery.or(scopeFilters.join(","));
  const { data: broadcasts } = await broadcastsQuery
    .order("pinned", { ascending: false })
    .order("sent_at", { ascending: false })
    .limit(3);

  const { data: tutorialInvites } = await supabase
    .from("individual_tutorial_invites")
    .select("id, stage, timetable_event_id, confirmed_at")
    .eq("trainee_id", traineeId)
    .is("confirmed_at", null);
  const tutorialEventIds = (tutorialInvites ?? []).map((i) => i.timetable_event_id);
  const { data: tutorialEvents } =
    tutorialEventIds.length > 0
      ? await supabase.from("course_timetable_events").select("id, event_date, event_time").in("id", tutorialEventIds)
      : { data: [] };
  const tutorialEventById = new Map((tutorialEvents ?? []).map((e) => [e.id, e]));

  const { data: gtkyAssignment } = await supabase
    .from("gtky_assignments")
    .select("chosen_slug")
    .eq("trainee_id", traineeId)
    .maybeSingle();

  const planByTpNumber = new Map((plans ?? []).map((p) => [p.tp_number, p]));
  const tpPlanByTpNumber = new Map((tpPlans ?? []).map((p) => [p.tp_number, p]));
  const selfEvalByTpNumber = new Map((selfEvaluations ?? []).map((s) => [s.tp_number, s]));
  const feedbackByTpNumber = new Map((feedbackRows ?? []).map((f) => [f.tp_number, f]));

  // "You teach today" -- reuses the exact same half/date bridge rotation.ts
  // and the trainer-side Teaching Practice queue already trust, scoped to
  // just this one trainee's own subgroup instead of a whole course scan.
  let teachingToday: { tpNumber: number; title: string; teachingOrder: number; groupSize: number; zoomUrl: string | null; roomOrLevel: string | null } | null = null;
  if (subgroupMember) {
    const subgroup = subgroupRow;
    const { data: members } = await supabase
      .from("course_subgroup_members")
      .select("trainee_id, base_slot")
      .eq("subgroup_id", subgroupMember.subgroup_id);
    const { data: tpEvents } = await supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", courseId)
      .eq("type", "tp")
      .eq("event_date", today);

    if (subgroup?.half_order && tpEvents && tpEvents.length > 0) {
      const allTpTimetableEvents: TpTimetableEvent[] = (
        await supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp")
      ).data ?? [];
      const halfDates = halfTpDates(allTpTimetableEvents, subgroup.half_order);
      const tpIndex = halfDates.indexOf(today);
      const tpNumber = tpIndex >= 0 ? tpIndex + 1 : null;
      const plan = tpNumber ? planByTpNumber.get(tpNumber) : null;
      if (tpNumber && plan && !plan.taught_at && (members ?? []).length > 0) {
        const size = (members ?? []).length;
        const order = rotationPosition(subgroupMember.base_slot, size, tpNumber) + 1;
        const event = tpEvents[0];
        teachingToday = {
          tpNumber,
          title: plan.short_title || plan.main_lesson_aim,
          teachingOrder: order,
          groupSize: size,
          zoomUrl: event.zoom_url,
          roomOrLevel: event.title,
        };
      }
    }
  }

  // Waiting on you -- capped at 3, this priority order: assignment due,
  // confirm a Stage 1/3 tutorial invite, self-evaluation due, observation
  // hours to log. Tutorial confirmation sits above self-evaluations -- it's
  // a one-time commitment tied to a specific date the tutor is waiting on,
  // not a rolling backlog item like self-evals, so it shouldn't get
  // crowded out by however many TPs happen to be awaiting a self-eval.
  const waiting: WaitingItem[] = [];
  for (const a of assignments ?? []) {
    if (a.first_status === "not_submitted" && a.due_date && a.due_date <= today) {
      waiting.push({
        label: `${ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type} due`,
        detail: a.due_date === today ? "Due today" : "Overdue",
        href: `/portfolio/${traineeId}/assignments/${a.id}`,
      });
    }
  }
  for (const invite of tutorialInvites ?? []) {
    const event = tutorialEventById.get(invite.timetable_event_id);
    const stageLabel = invite.stage === "stage1" ? "Stage 1" : "Stage 3";
    waiting.push({
      label: `Confirm your ${stageLabel} tutorial`,
      detail: event ? `${event.event_date}${event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}` : "Time set by your tutor",
      href: `/portfolio/${traineeId}/individual-tutorial/${invite.id}`,
    });
  }
  if (gtkyAssignment && !gtkyAssignment.chosen_slug) {
    waiting.push({
      label: "Choose your day-one activity",
      detail: "Three options, waiting for you -- pick one before the first morning",
      href: `/portfolio/${traineeId}/gtky`,
    });
  }
  for (const [tpNumber, plan] of planByTpNumber) {
    if (!plan.taught_at) continue;
    const status = getTpCardStatus({
      planSubmitted: Boolean(tpPlanByTpNumber.get(tpNumber)?.submitted_at),
      taught: true,
      selfEvalSubmitted: Boolean(selfEvalByTpNumber.get(tpNumber)?.submitted_at),
      feedbackSubmitted: Boolean(feedbackByTpNumber.get(tpNumber)?.submitted_at),
      grade: feedbackByTpNumber.get(tpNumber)?.grade,
    });
    if (status.label === "Self-evaluation due") {
      waiting.push({ label: `TP${tpNumber} self-evaluation`, detail: "Write it before feedback opens", href: `/portfolio/${traineeId}/tp/${tpNumber}` });
    }
  }
  const observedMinutes = (observations ?? []).reduce((sum, o) => sum + (o.length_minutes ?? 0), 0);
  if (observedMinutes / 60 < OBSERVATION_HOURS_REQUIRED) {
    waiting.push({
      label: "Observation hours",
      detail: `${(observedMinutes / 60).toFixed(1)} of ${OBSERVATION_HOURS_REQUIRED} hrs logged`,
      href: `/portfolio/${traineeId}/celta5`,
    });
  }
  const waitingCapped = waiting.slice(0, 3);

  const weekOf = course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;
  const eyebrow = [courseName, weekOf].filter(Boolean).join(" · ");
  const todayHeading = new Date(`${today}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">{eyebrow}</p>
          <h1 className="font-serif text-2xl text-ink">{todayHeading}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/portfolio/${traineeId}/timetable`} className="rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink hover:border-primary">
            My timetable
          </Link>
          {teachingToday ? (
            <Link href={`/portfolio/${traineeId}/tp/${teachingToday.tpNumber}`} className="rounded-[6px] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
              Open TP{teachingToday.tpNumber} plan
            </Link>
          ) : null}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-5 ${teachingToday ? "lg:grid-cols-[1.2fr_1fr_1fr]" : "lg:grid-cols-2"}`}>
        {teachingToday ? (
          <div className="sheet-accent flex flex-col gap-3">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">You teach today</p>
            <p className="font-serif text-xl text-ink">
              TP{teachingToday.tpNumber} — {teachingToday.title}
            </p>
            <p className="text-sm text-muted">
              {teachingToday.teachingOrder === 1 ? "1st" : teachingToday.teachingOrder === 2 ? "2nd" : `${teachingToday.teachingOrder}th`} of{" "}
              {teachingToday.groupSize} today · {TP_LESSON_LENGTH_MINUTES} min
            </p>
            <div className="flex items-center gap-2">
              {teachingToday.zoomUrl ? (
                <a href={teachingToday.zoomUrl} target="_blank" rel="noreferrer" className="rounded-[6px] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground">
                  Join the room
                </a>
              ) : null}
              <Link href={`/portfolio/${traineeId}/tp/${teachingToday.tpNumber}`} className="rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink hover:border-primary">
                Open your plan
              </Link>
            </div>
          </div>
        ) : null}

        {/* Announcements */}
        <div className="sheet flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">Announcements</p>
          {(broadcasts ?? []).length === 0 ? (
            <p className="text-sm text-muted">Nothing posted yet.</p>
          ) : (
            <div className="flex flex-col">
              {(broadcasts ?? []).map((b, i) => (
                <div key={b.id} className={`flex flex-col gap-1 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""} ${b.pinned ? "border-l-2 border-gold pl-2.5" : ""}`}>
                  <p className={`text-sm ${b.pinned ? "font-bold text-ink" : "font-semibold text-ink"}`}>{b.title}</p>
                  {b.body ? (
                    <div className="flex flex-col gap-2 text-sm whitespace-pre-line text-ink">{b.body}</div>
                  ) : null}
                  <p className="text-xs text-muted">{new Date(b.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Waiting on you */}
        <div className="sheet flex flex-col gap-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">Waiting on you</p>
          {waitingCapped.length === 0 ? (
            <p className="text-sm text-muted">Nothing waiting on you right now.</p>
          ) : (
            <div className="flex flex-col">
              {waitingCapped.map((w, i) => (
                <Link key={i} href={w.href} className={`flex flex-col gap-0.5 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                  <p className="text-sm font-semibold text-ink">{w.label}</p>
                  <p className="text-xs text-muted">{w.detail}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
