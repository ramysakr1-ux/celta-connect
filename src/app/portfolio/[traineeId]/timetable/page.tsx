import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { resolveTimeBands, toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { halfTpDates, halfOwningDate, type TpTimetableEvent } from "@/lib/rotation";
import { groupCodeForHalf, isMine, type HalfInfo } from "@/lib/timetable-read-only";
import { ReadOnlyTimetableBoard } from "@/app/portfolio/[traineeId]/timetable/read-only-board";
import { SupervisedSessionsPanel } from "@/app/portfolio/[traineeId]/timetable/supervised-sessions-panel";
import type { TimetableEvent } from "@/lib/timetable-grid";
import { markScavengerHuntFound } from "@/lib/scavenger-hunt";

// for-claude-code-timetable-view.md's read-only 4-week board -- trainee's
// own view, and what staff see when previewing a trainee's portfolio
// (preview !== "trainee" gate below, same pattern as the rest of this
// section). "Mine" involvement and TP letter codes are derived fresh each
// render (see timetable-read-only.ts) -- nothing new stored.
export default async function TraineeTimetablePage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { traineeId } = await params;
  const { preview } = await searchParams;
  const session = await getCurrentProfile();
  const viewer = session?.profile ?? null;
  const assessorCourseId = !viewer ? await getAssessorCourseId() : null;
  if (!viewer && !assessorCourseId) notFound();
  const isStaff = (viewer?.role === "trainer" || viewer?.role === "admin") && preview !== "trainee";

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: trainee } = await supabase.from("profiles").select("course_id, center_id, full_name").eq("id", traineeId).maybeSingle();
  if (!trainee?.course_id) notFound();
  if (assessorCourseId && trainee.course_id !== assessorCourseId) notFound();

  const timeZone = (await getCachedCenter(trainee.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  // Scavenger hunt Q2 ("Who else is in Group ABC with you?") -- the group
  // name shows in this page's own header, so a real trainee landing here
  // resolves it.
  if (viewer?.role === "trainee" && !isStaff) {
    await markScavengerHuntFound(supabase, trainee.course_id, viewer.id, "group");
  }

  const [{ data: course }, { data: events }, { data: plans }, { data: subgroupMember }, { data: supervisedCompletions }] = await Promise.all([
    supabase.from("courses").select("time_bands").eq("id", trainee.course_id).maybeSingle(),
    supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", trainee.course_id)
      .order("event_date")
      .order("event_time"),
    supabase.from("plan_assignments").select("tp_number, taught_at").eq("trainee_id", traineeId),
    supabase.from("course_subgroup_members").select("subgroup_id, base_slot").eq("trainee_id", traineeId).maybeSingle(),
    supabase
      .from("supervised_session_completions")
      .select("timetable_event_id, time_spent_seconds, response, submitted_at, checked_at, quiz_topic, score, question_count")
      .eq("trainee_id", traineeId),
  ]);

  const timeBands = resolveTimeBands(course?.time_bands ?? null);
  const allEvents: TimetableEvent[] = events ?? [];
  const tpEvents: TpTimetableEvent[] = allEvents.filter((e) => e.type === "tp").map((e) => ({ event_date: e.event_date }));

  // Ramy, 25 Aug 2026: "the trainees also should know" how many volunteers
  // are coming -- same aggregate-only, no-names treatment as the trainer's
  // own timetable (src/app/trainer/(hub)/timetable/page.tsx). Admin client
  // specifically for volunteer_declines -- that table's RLS only grants
  // trainer/admin read access (0143_volunteer_declines.sql), no trainee
  // policy exists, so the page's own RLS-bound client would silently see
  // zero declines and show every event as fully attended.
  const declinesAdmin = createAdminClient();
  const { data: volunteers } = await supabase.from("volunteer_students").select("id").eq("course_id", trainee.course_id).is("removed_at", null);
  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const { data: volunteerDeclines } =
    volunteerIds.length > 0
      ? await declinesAdmin.from("volunteer_declines").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", volunteerIds)
      : { data: [] };
  const declinedCountByEvent = new Map<string, number>();
  for (const d of volunteerDeclines ?? []) {
    declinedCountByEvent.set(d.timetable_event_id, (declinedCountByEvent.get(d.timetable_event_id) ?? 0) + 1);
  }

  // "Their own TP lessons" -- only resolvable for a paired subgroup, same
  // honest limit as the trainer-side TP Marking Queue/Rotation board (see
  // src/lib/rotation.ts's own comments): an unpaired subgroup has no date
  // system to check a personal teaching date against.
  const ownTpDates = new Set<string>();
  let viewerHalfOrder: 1 | 2 | null = null;
  let viewerSubgroupId: string | null = null;
  let viewerGroupLabel: string | null = null;
  const halvesByCode = new Map<string, string>(); // computed "ABC"/"DEF" -> subgroupId

  if (subgroupMember) {
    viewerSubgroupId = subgroupMember.subgroup_id;
    const { data: subgroup } = await supabase
      .from("course_subgroups")
      .select("id, tp_group_id, half_order, name")
      .eq("id", subgroupMember.subgroup_id)
      .maybeSingle();

    if (subgroup?.half_order) {
      viewerHalfOrder = subgroup.half_order as 1 | 2;
      const halfTpTimetableEvents: TpTimetableEvent[] = tpEvents;
      const halfDates = halfTpDates(halfTpTimetableEvents, viewerHalfOrder);
      const assignedTpNumbers = new Set((plans ?? []).map((p) => p.tp_number));
      halfDates.forEach((date, i) => {
        if (assignedTpNumbers.has(i + 1)) ownTpDates.add(date);
      });
    }

    if (subgroup?.tp_group_id) {
      const { data: tpGroup } = await supabase.from("course_tp_groups").select("name").eq("id", subgroup.tp_group_id).maybeSingle();
      const { data: siblingSubgroups } = await supabase
        .from("course_subgroups")
        .select("id, half_order")
        .eq("tp_group_id", subgroup.tp_group_id);
      const subgroupIds = (siblingSubgroups ?? []).map((s) => s.id);
      const { data: allMembers } = subgroupIds.length
        ? await supabase.from("course_subgroup_members").select("subgroup_id, trainee_id, base_slot").in("subgroup_id", subgroupIds)
        : { data: [] };

      const halves: HalfInfo[] = (siblingSubgroups ?? [])
        .filter((s): s is { id: string; half_order: 1 | 2 } => s.half_order === 1 || s.half_order === 2)
        .map((s) => ({
          subgroupId: s.id,
          halfOrder: s.half_order as 1 | 2,
          members: (allMembers ?? [])
            .filter((m) => m.subgroup_id === s.id)
            .map((m) => ({ traineeId: m.trainee_id, subgroupId: s.id, baseSlot: m.base_slot })),
        }));

      for (const half of halves) {
        halvesByCode.set(groupCodeForHalf(half), half.subgroupId);
      }
      viewerGroupLabel = tpGroup?.name ?? subgroup.name ?? null;
    } else {
      viewerGroupLabel = subgroup?.name ?? null;
    }
  }

  const isMineEvent = (event: TimetableEvent) =>
    isMine({
      eventTag: event.tag,
      eventType: event.type,
      eventDate: event.event_date,
      viewer: { subgroupId: viewerSubgroupId, tpGroupId: null },
      tpEvents,
      viewerHalfOrder,
      groupCodeByTag: halvesByCode,
    });

  const isOwnTpSlot = (event: TimetableEvent) => event.type === "tp" && ownTpDates.has(event.event_date);

  const teachingLettersFor = (event: TimetableEvent): string | null => {
    if (event.type !== "tp" || !viewerSubgroupId) return null;
    const owningHalfOrder = halfOwningDate(tpEvents, event.event_date);
    if (owningHalfOrder === null) return null;
    for (const [code, subgroupId] of halvesByCode) {
      if (subgroupId === viewerSubgroupId && owningHalfOrder === viewerHalfOrder) return code;
    }
    // Not the viewer's own half teaching that day -- still show the owning
    // half's code if we can find it (any half whose halfOrder matches).
    return null;
  };

  // Functions can't cross the server/client component boundary -- precompute
  // per-event involvement here and pass plain data down instead.
  const eventMeta: Record<
    string,
    { mine: boolean; ownTpSlot: boolean; teachingLetters: string | null; volunteerAttendance: { expected: number; total: number } | null }
  > = {};
  for (const event of allEvents) {
    eventMeta[event.id] = {
      mine: isMineEvent(event),
      ownTpSlot: isOwnTpSlot(event),
      teachingLetters: teachingLettersFor(event),
      volunteerAttendance:
        event.type === "tp" && volunteerIds.length > 0
          ? { total: volunteerIds.length, expected: volunteerIds.length - (declinedCountByEvent.get(event.id) ?? 0) }
          : null,
    };
  }

  return (
    <div className="flex flex-col gap-5">
      {!isStaff ? (
        <div className="flex justify-end">
          <a
            href={`/api/portfolio/${traineeId}/timetable.ics`}
            className="rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink trainee-hover-fill"
          >
            Add to my calendar
          </a>
        </div>
      ) : null}

      {allEvents.length === 0 ? (
        <div className="sheet text-sm text-muted">No events yet.</div>
      ) : (
        <ReadOnlyTimetableBoard
          events={allEvents}
          eventMeta={eventMeta}
          timeBands={timeBands}
          viewerName={trainee.full_name ?? "You"}
          viewerGroupLabel={viewerGroupLabel}
          today={today}
          nowIso={new Date().toISOString()}
          timeZone={timeZone}
        />
      )}

      {isStaff ? (
        <SupervisedSessionsPanel
          traineeId={traineeId}
          events={allEvents.filter((e) => e.type === "supervised_session").map((e) => ({ id: e.id, title: e.title, event_date: e.event_date }))}
          completions={supervisedCompletions ?? []}
        />
      ) : null}
    </div>
  );
}
