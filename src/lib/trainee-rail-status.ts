import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { halfTpDates, type TpTimetableEvent } from "@/lib/rotation";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";
import { formatDate } from "@/lib/format-date";

// The status line under each door in the trainee's rail.
//
// design_handoff_trainee_landing, option 4b: "a second line under each label...
// This is the whole point of the option: the rail says whether a room needs you
// before you open it." Plus a gold dot on any door with something live today.
//
// Ramy, 9 Sep 2026, choosing where this runs: "plugged into the layout." The
// rail is rendered from layout.tsx, so these lines are computed for every page
// in the trainee workspace even though focus-row.tsx hides the rail the moment
// they step into a room. That is the cost he accepted; this file's job is to
// keep it to one wave of small, trainee-scoped reads and no more.
//
// Nothing here is approximated. A status line that guesses is worse than no
// status line at all -- it would send someone into a room for nothing, which is
// precisely the trip the rail exists to save.

export interface RailDoorStatus {
  status: string;
  live: boolean;
  urgent: boolean;
}

export interface RailStatus {
  /** Keyed by the door's href suffix, as SIDEBAR_TABS declares them. */
  byHref: Record<string, RailDoorStatus>;
  /** The foot: "Week 3 of 5" over the tick strip. */
  weekNumber: number | null;
  weekTotal: number | null;
  /** "TP4 of 8" -- the TP they are on, not the count taught. */
  tpNumber: number | null;
  tpTotal: number | null;
}

const EMPTY: RailStatus = { byHref: {}, weekNumber: null, weekTotal: null, tpNumber: null, tpTotal: null };

export async function buildRailStatus({
  supabase,
  traineeId,
  courseId,
  todayIso,
  timeZone,
  weekNumber,
  weekTotal,
}: {
  supabase: SupabaseClient<Database>;
  traineeId: string;
  courseId: string | null;
  todayIso: string;
  /** The centre's zone -- a due date rendered raw is the bug the 6 Sep hub
   *  audit spent 38 call sites removing. It does not come back here. */
  timeZone: string;
  weekNumber: number | null;
  weekTotal: number | null;
}): Promise<RailStatus> {
  if (!courseId) return EMPTY;

  const [{ data: subgroupMember }, { data: assignments }, { data: plans }, { data: invites }, { data: todaysEvents }] =
    await Promise.all([
      supabase.from("course_subgroup_members").select("subgroup_id").eq("trainee_id", traineeId).maybeSingle(),
      supabase.from("assignments").select("assignment_type, due_date, first_status").eq("trainee_id", traineeId),
      supabase.from("plan_assignments").select("tp_number, taught_at, short_title").eq("trainee_id", traineeId),
      supabase
        .from("individual_tutorial_invites")
        .select("stage")
        .eq("trainee_id", traineeId)
        .is("confirmed_at", null),
      supabase
        .from("course_timetable_events")
        .select("type, title, event_time")
        .eq("course_id", courseId)
        .eq("event_date", todayIso),
    ]);

  // Which TP round today is, for this trainee's half -- the same halfTpDates
  // bridge rotation.ts and the trainer-side queue already trust, rather than a
  // second interpretation of the same schedule.
  const subgroup = subgroupMember
    ? (await supabase.from("course_subgroups").select("half_order").eq("id", subgroupMember.subgroup_id).maybeSingle()).data
    : null;
  const allTpEvents: TpTimetableEvent[] = subgroup?.half_order
    ? ((await supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp")).data ??
      [])
    : [];
  const halfDates = subgroup?.half_order ? halfTpDates(allTpEvents, subgroup.half_order) : [];
  const teachesToday = halfDates.includes(todayIso);
  const tpToday = teachesToday ? halfDates.indexOf(todayIso) + 1 : null;

  const untaught = (plans ?? []).filter((p) => !p.taught_at).sort((a, b) => a.tp_number - b.tp_number);
  const nextTp = untaught[0] ?? null;
  const currentTp = tpToday ?? nextTp?.tp_number ?? null;

  const times = (todaysEvents ?? []).map((e) => e.event_time).filter((t): t is string => Boolean(t));
  const firstTime = times.length > 0 ? times.slice().sort()[0].slice(0, 5) : null;
  const feedback = (todaysEvents ?? []).find((e) => e.title === "Feedback" && e.event_time)?.event_time?.slice(0, 5) ?? null;
  const myTpTime =
    (todaysEvents ?? []).find((e) => e.type === "tp" && e.event_time)?.event_time?.slice(0, 5) ?? null;

  const byHref: Record<string, RailDoorStatus> = {};

  // Course Stream -- what today is.
  byHref[""] = teachesToday
    ? {
        status: [myTpTime ? `You teach ${myTpTime}` : "You teach today", feedback ? `feedback ${feedback}` : null]
          .filter(Boolean)
          .join(" · "),
        live: true,
        urgent: false,
      }
    : (todaysEvents ?? []).length > 0
      ? {
          status: [myTpTime ? `You observe ${myTpTime}` : firstTime ? `From ${firstTime}` : null, feedback ? `feedback ${feedback}` : null]
            .filter(Boolean)
            .join(" · ") || "Sessions today",
          live: true,
          urgent: false,
        }
      : { status: "Nothing timetabled today", live: false, urgent: false };

  // Teaching Practice -- the plan they owe, or today's lesson.
  byHref["/tp"] = teachesToday && tpToday !== null
    ? {
        // "next" means after today. An untaught TP with a LOWER number than
        // today's is a gap in the record, not the next thing to prepare, and
        // announcing it as next read as nonsense ("TP8 today · TP7 next").
        status: `TP${tpToday} today${nextTp && nextTp.tp_number > tpToday ? ` · TP${nextTp.tp_number} next` : ""}`,
        live: true,
        urgent: false,
      }
    : nextTp
      ? { status: `TP${nextTp.tp_number} plan${nextTp.short_title ? ` · ${nextTp.short_title}` : ""}`, live: false, urgent: false }
      : { status: "All your TPs are taught", live: false, urgent: false };

  // Written Assignments -- the only door that ever turns garnet.
  const outstanding = (assignments ?? [])
    .filter((a) => a.first_status === "not_submitted" && a.due_date)
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const soonest = outstanding[0] ?? null;
  const shortName = (t: string) => ASSIGNMENT_INFO[t as AssignmentTypeValue]?.title ?? t;
  byHref["/assignments"] = soonest
    ? soonest.due_date! <= todayIso
      ? {
          status: `${shortName(soonest.assignment_type)} ${soonest.due_date === todayIso ? "due today" : "overdue"}`,
          live: true,
          urgent: true,
        }
      : {
          status: `${shortName(soonest.assignment_type)} due ${formatDate(soonest.due_date, timeZone, { day: "numeric", month: "short" })}`,
          live: false,
          urgent: false,
        }
    : { status: "Nothing outstanding", live: false, urgent: false };

  // CELTA 5 -- a tutorial waiting on their confirmation is the one thing in
  // there that is actually blocked on the trainee.
  const invite = (invites ?? [])[0] ?? null;
  byHref["/celta5"] = invite
    ? { status: `${invite.stage === "stage1" ? "Stage 1" : "Stage 3"} tutorial to confirm`, live: true, urgent: false }
    : { status: "Your record and criteria", live: false, urgent: false };

  // Resource Hub -- no per-trainee state worth a line; it is a library, and
  // saying "materials ready" every day of the course would be noise, not news.
  byHref["/resources"] = { status: "Materials and readings", live: false, urgent: false };

  return {
    byHref,
    weekNumber,
    weekTotal,
    tpNumber: currentTp,
    tpTotal: halfDates.length > 0 ? halfDates.length : null,
  };
}
