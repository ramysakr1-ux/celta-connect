import Link from "next/link";
import { AlsoUnder } from "@/app/trainer/(hub)/also-under";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMctOnCourse } from "@/lib/course-mct";
import { setTimetableLock, recomputeAssignmentDueDates } from "@/app/trainer/(hub)/timetable/actions";
import { AddEventForm } from "@/app/trainer/(hub)/timetable/add-event-form";
import { GenerateSkeletonForm } from "@/app/trainer/(hub)/timetable/generate-skeleton-form";
import { DragBoard, type UnmatchedParticipant } from "@/app/trainer/(hub)/timetable/drag-board";
import { TimeBandsForm } from "@/app/trainer/(hub)/timetable/time-bands-form";
import { resolveTimeBands, toLocalIso, DEFAULT_TIMEZONE, type TimetableEvent, type TimeBand } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { halfOwningDate, type TpTimetableEvent } from "@/lib/rotation";
import { ReadOnlyTimetableBoard, type EventMeta } from "@/app/portfolio/[traineeId]/timetable/read-only-board";
import { Stage2Section } from "@/app/trainer/(hub)/timetable/stage2-section";
import { IndividualTutorialSection } from "@/app/trainer/(hub)/timetable/individual-tutorial-section";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";

// for-claude-code-timetable-edit-vs-view.md: DragBoard (editing) and the
// glass-card view (for-claude-code-timetable-view.md) are two different
// tools, not competing designs -- this page now defaults to the view (the
// day-to-day glance/join screen, ?mode isn't "edit"), with DragBoard and
// the rest of course setup moved to a secondary MCT-only "Edit timetable"
// mode. See read-only-board.tsx (already built for the trainee/portfolio
// side) -- reused as-is here, just fed trainer-shaped viewer data.
export default async function TrainerTimetablePage({
  searchParams,
}: {
  searchParams: Promise<{ lock_error?: string; date?: string; half?: string; run?: string; mode?: string }>;
}) {
  // for-claude-code-assessor-tour-mode.md: same widening pattern as
  // roster/page.tsx and resource-hub/page.tsx -- a real session first,
  // fall back to a touring assessor's course, everyone else turned away.
  // Edit mode (below) stays MCT-only either way -- isMct is structurally
  // false with no trainer, so editMode can never be true for an assessor
  // regardless of the ?mode=edit query param.
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  // Gates on the assessor's own course, NOT on tour mode. Ramy, 29 Aug
  // 2026: "all those assessor links don't really work." Two of the six
  // cohort documents in the pack -- "Course timetable" and "Lesson plans
  // for the day" -- link straight here (assessor/page.tsx's
  // COHORT_DOC_HREF), and an assessor who hasn't taken the optional tour
  // has no tour cookie, so both bounced to a login they cannot use. Tour
  // mode decides which TABS the hub shows, which is a presentation
  // choice; it was never meant to be the authorization gate. Same shape
  // as grades-report and roster, the two pack links that did work.
  if (!trainer && !assessorCourseId) redirect("/login");

  const { lock_error, date: lockErrorDate, half: lockErrorHalf, run: lockErrorRun, mode } = await searchParams;
  const supabase = trainer ? await createClient() : createAdminClient();

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return (
      <div className="sheet text-sm text-muted">No course assigned.</div>
    );
  }

  const [{ data: course }, { data: events }, { data: volunteers }] = await Promise.all([
    supabase.from("courses").select("timetable_locked_at, time_bands, delivery_mode, center_id, assessor_visit_date").eq("id", courseId).maybeSingle(),
    supabase
      .from("course_timetable_events")
      .select("*")
      .eq("course_id", courseId)
      .order("event_date")
      .order("event_time"),
    supabase.from("volunteer_students").select("id, name").eq("course_id", courseId).is("removed_at", null).order("name"),
  ]);
  const baseEvents: TimetableEvent[] = events ?? [];

  const assessorVisitDate = assessorCourseId ? (course?.assessor_visit_date ?? null) : null;
  const isAssessorViewer = Boolean(assessorCourseId) && !trainer;

  // Ramy, 30 Aug 2026: "when the assessor clicks on the timetable, is there a
  // chance they can also see the grades meeting even though it's not meant to
  // be on the timetable? Is there a trick that only the assessor can see it?"
  //
  // Yes, and the safe trick is the obvious one: don't store it. This row is
  // built here, in the assessor's own render, and never written to
  // course_timetable_events -- so no query a candidate or tutor makes can
  // return it, because there is nothing in the table to return. It cannot
  // leak by someone forgetting a filter later, which a stored-and-hidden row
  // eventually would.
  //
  // The id is a literal rather than a uuid so it is obvious in any log or
  // debugger that this is not a database row.
  const GRADING_MEETING_ID = "assessor-only-grading-meeting";
  const gradingMeetingEvent: TimetableEvent | null =
    isAssessorViewer && assessorVisitDate
      ? ({
          ...(baseEvents[0] ?? {}),
          id: GRADING_MEETING_ID,
          course_id: courseId,
          type: "supervised_session",
          title: "Grading meeting",
          detail: "With all tutors. Yours only -- not on the candidates' timetable.",
          event_date: assessorVisitDate,
          event_time: gradingMeetingTime(baseEvents, assessorVisitDate, course?.time_bands),
          tag: "group_room",
          zoom_url: null,
          linked_assignment_type: null,
          linked_tp_number: null,
        } as TimetableEvent)
      : null;

  const allEvents: TimetableEvent[] = gradingMeetingEvent ? [...baseEvents, gradingMeetingEvent] : baseEvents;

  // Ramy, 25 Aug 2026: "the trainers should show if they are... how many
  // volunteers... attending" -- aggregate only, no names. Total is fixed
  // per course; only the per-event decline count varies.
  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const { data: volunteerDeclines } =
    volunteerIds.length > 0
      ? await supabase.from("volunteer_declines").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", volunteerIds)
      : { data: [] };
  const declinedCountByEvent = new Map<string, number>();
  for (const d of volunteerDeclines ?? []) {
    declinedCountByEvent.set(d.timetable_event_id, (declinedCountByEvent.get(d.timetable_event_id) ?? 0) + 1);
  }

  // Ramy, 2026-08-23: ACT doesn't make changes to the timetable, so doesn't
  // need to see those options -- mirrors actions.ts' requireTimetableEditAccess
  // exactly (same isMctOnCourse() check, admin bypass), so the UI never
  // offers a control the server would then reject.
  const isMct = Boolean(trainer) && (trainer!.role === "admin" || (await isMctOnCourse(supabase, courseId, trainer!.id)));
  // Non-MCT trying to force ?mode=edit just falls back to the view -- there
  // is no separate "disabled" edit mode to render, and nothing to explain.
  const editMode = mode === "edit" && isMct;

  const locked = Boolean(course?.timetable_locked_at);
  const timeBands = resolveTimeBands(course?.time_bands ?? null);
  const isCustomTimeBands = Boolean(course?.time_bands && course.time_bands.length > 0);
  const timeZone = (course ? (await getCachedCenter(course.center_id))?.time_zone : null) ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  // The grid no longer prints a strong week header of its own (apply-to-app.md
  // §2.7), so the edit-mode header carries the overall date range instead.
  const weekRange = (() => {
    if (allEvents.length === 0) return null;
    const dates = [...allEvents].map((e) => e.event_date).sort();
    const fmt = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    const first = dates[0];
    const last = dates[dates.length - 1];
    return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
  })();

  const tpEventIds = allEvents.filter((e) => e.type === "tp").map((e) => e.id);
  const [{ data: attendanceRows }, { data: unmatchedRows }] = await Promise.all([
    tpEventIds.length > 0
      ? supabase.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id, source").in("timetable_event_id", tpEventIds)
      : Promise.resolve({ data: [] }),
    // zoom-auto-attendance.md §4 -- participants the webhook couldn't
    // confidently match, waiting on the trainer to resolve.
    tpEventIds.length > 0
      ? supabase
          .from("zoom_unmatched_participants")
          .select("id, timetable_event_id, zoom_email, zoom_display_name, suggested_volunteer_student_id, joined_at")
          .in("timetable_event_id", tpEventIds)
          .is("resolved_at", null)
      : Promise.resolve({ data: [] }),
  ]);
  const attendedByEvent = new Map<string, Set<string>>();
  const attendanceSourceByEvent = new Map<string, Map<string, "manual" | "zoom">>();
  for (const row of attendanceRows ?? []) {
    const set = attendedByEvent.get(row.timetable_event_id) ?? new Set<string>();
    set.add(row.volunteer_student_id);
    attendedByEvent.set(row.timetable_event_id, set);
    const sourceMap = attendanceSourceByEvent.get(row.timetable_event_id) ?? new Map<string, "manual" | "zoom">();
    sourceMap.set(row.volunteer_student_id, row.source);
    attendanceSourceByEvent.set(row.timetable_event_id, sourceMap);
  }
  const unmatchedByEvent = new Map<string, UnmatchedParticipant[]>();
  for (const row of unmatchedRows ?? []) {
    const list = unmatchedByEvent.get(row.timetable_event_id) ?? [];
    list.push(row);
    unmatchedByEvent.set(row.timetable_event_id, list);
  }

  // Stage 2 tutorial booking sheet (3a) -- groups list matches Rotation's
  // own paired-tp-group / unpaired-subgroup enumeration exactly, and blocks
  // aren't gated by timetable_locked_at: tutorials get scheduled as the
  // course actually progresses, well after the base shape is locked.
  const [{ data: subgroups }, { data: tpGroups }, { data: blocks }, { data: subgroupMembers }] = await Promise.all([
    supabase.from("course_subgroups").select("id, name, tp_group_id, half_order").eq("course_id", courseId).order("created_at"),
    supabase.from("course_tp_groups").select("id, name, tutor_profile_id").eq("course_id", courseId),
    supabase
      .from("stage2_tutorial_blocks")
      .select("id, tp_group_id, subgroup_id, timetable_event_id")
      .eq("course_id", courseId),
    supabase.from("course_subgroup_members").select("subgroup_id, trainee_id"),
  ]);

  // for-claude-code-timetable-page-priority.md (revised): "Stage 2 group
  // tutorial booking and Stage 1/3 individual invites: per-TP-tutor, not
  // MCT-only -- each TP tutor runs tutorials with their own group, so they
  // own booking for their own group's sheet." Admin keeps full visibility
  // (not a TP tutor, same bypass every other gate on this page already
  // gives it). An unpaired subgroup has no tutor_profile_id anywhere in the
  // schema to test against -- left visible to every trainer rather than
  // guessed at, flagged here rather than silently hidden.
  const isAdmin = trainer?.role === "admin";
  const ownedGroupIds = new Set((tpGroups ?? []).filter((g) => trainer && g.tutor_profile_id === trainer.id).map((g) => g.id));
  const pairedTpGroupIds = new Set((subgroups ?? []).filter((s) => s.tp_group_id).map((s) => s.tp_group_id));
  const stage2Groups = [
    ...(tpGroups ?? [])
      .filter((g) => pairedTpGroupIds.has(g.id) && (isAdmin || ownedGroupIds.has(g.id)))
      .map((g) => ({ kind: "tpgroup" as const, id: g.id, name: g.name })),
    ...(subgroups ?? []).filter((s) => !s.tp_group_id).map((s) => ({ kind: "subgroup" as const, id: s.id, name: s.name })),
  ];
  const visibleGroupIds = new Set(stage2Groups.map((g) => g.id));
  const blockEventById = new Map(allEvents.map((e) => [e.id, e]));
  const stage2Blocks = (blocks ?? [])
    .filter((b) => (b.tp_group_id ? visibleGroupIds.has(b.tp_group_id) : visibleGroupIds.has(b.subgroup_id ?? "")))
    .map((b) => {
      const event = blockEventById.get(b.timetable_event_id);
      const group = stage2Groups.find((g) => (b.tp_group_id ? g.id === b.tp_group_id : g.id === b.subgroup_id));
      return { id: b.id, groupName: group?.name ?? "Unknown group", eventDate: event?.event_date ?? "" };
    });

  // Same per-tutor scoping for Stage 1/3: a candidate is "the trainer's own"
  // if they're a member of a subgroup belonging to a TP group the trainer
  // tutors. A trainee in an unpaired subgroup has no owning tutor to test
  // against (same gap as above) -- left visible to every trainer. And
  // before any subgroup exists at all (course not yet organized into TP
  // groups -- true of every course early on), there's nothing to scope by
  // full stop; fails open rather than showing an empty "no candidates" for
  // a course that just hasn't set up groups yet.
  const noSubgroupStructureYet = (subgroups ?? []).length === 0;
  const ownedSubgroupIds = new Set((subgroups ?? []).filter((s) => s.tp_group_id && ownedGroupIds.has(s.tp_group_id)).map((s) => s.id));
  const unpairedSubgroupIds = new Set((subgroups ?? []).filter((s) => !s.tp_group_id).map((s) => s.id));
  const ownTraineeIds = new Set(
    (subgroupMembers ?? [])
      .filter((m) => isAdmin || ownedSubgroupIds.has(m.subgroup_id) || unpairedSubgroupIds.has(m.subgroup_id))
      .map((m) => m.trainee_id)
  );

  // Stage 1 / Stage 3 individualized invites -- one candidate, one time,
  // unlike Stage 2's group sheet above. Stage 3 only offers candidates the
  // trainer has actually flagged (celta5_records.stage3_tutorial_required) -- it's
  // conditional per-candidate, not a whole-cohort checkpoint like Stage 1.
  const [{ data: activeTrainees }, { data: stage3Records }, { data: invites }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("course_id", courseId)
      .eq("role", "trainee")
      .eq("course_status", "active")
      .order("full_name"),
    supabase.from("celta5_records").select("trainee_id, stage3_tutorial_required").eq("course_id", courseId),
    supabase
      .from("individual_tutorial_invites")
      .select("id, trainee_id, stage, timetable_event_id, confirmed_at")
      .eq("course_id", courseId),
  ]);
  const traineeNameById = new Map((activeTrainees ?? []).map((t) => [t.id, t.full_name]));
  const stage3EligibleIds = new Set((stage3Records ?? []).filter((r) => r.stage3_tutorial_required).map((r) => r.trainee_id));
  const allCandidates = (activeTrainees ?? [])
    .filter((t) => noSubgroupStructureYet || ownTraineeIds.has(t.id))
    .map((t) => ({ id: t.id, name: t.full_name }));
  const stage3Candidates = allCandidates.filter((t) => stage3EligibleIds.has(t.id));

  const inviteSummaries = (invites ?? []).map((i) => {
    const event = blockEventById.get(i.timetable_event_id);
    return {
      id: i.id,
      stage: i.stage,
      traineeId: i.trainee_id,
      traineeName: traineeNameById.get(i.trainee_id) ?? "Unknown",
      eventDate: event?.event_date ?? "",
      eventTime: event?.event_time ?? null,
      confirmed: Boolean(i.confirmed_at),
    };
  });
  const stage1Invites = inviteSummaries.filter((i) => i.stage === "stage1");
  const stage3Invites = inviteSummaries.filter((i) => i.stage === "stage3");

  // Glass-card view's "Mine" involvement, trainer-shaped: read-only-board.tsx
  // was built for a TRAINEE viewer (one specific lettered TP slot); a trainer
  // has no such slot, so "mine" here means "a TP group I tutor"
  // (course_tp_groups.tutor_profile_id) rather than a personal A-F code.
  // Simplification, flagged rather than invented: non-TP events carry only a
  // free-text tag (no group id), so there's no reliable way to test them
  // against group ownership the way TP dates can be tested against
  // halfOwningDate -- they're left "mine" for everyone (unfaded) in both
  // modes, same treatment untagged whole-cohort sessions already get. No
  // "You teach" gold tag either -- that's the spec's trainee-only marker for
  // their own personal teaching slot, which doesn't apply to a trainer.
  // (ownedGroupIds itself is computed above, reused from the Stage 2/1/3
  // per-tutor scoping.)
  const ownedHalfOrders = new Set<1 | 2>();
  for (const s of subgroups ?? []) {
    if (s.tp_group_id && ownedGroupIds.has(s.tp_group_id) && (s.half_order === 1 || s.half_order === 2)) {
      ownedHalfOrders.add(s.half_order);
    }
  }
  const tpEventsForRotation: TpTimetableEvent[] = allEvents.filter((e) => e.type === "tp").map((e) => ({ event_date: e.event_date }));
  const viewerGroupLabel = (tpGroups ?? []).filter((g) => ownedGroupIds.has(g.id)).map((g) => g.name).join(" / ") || null;

  // Ramy, 30 Aug 2026: "when the assessor goes to the timetable, there is the
  // timetable for the whole course, and then there is mine. Mine should refer
  // to the assessor... only focus on the TP the assessor is observing, the
  // meeting with the trainees, the grade meeting, the feedback."
  //
  // That list is the Handbook's own (13.1: "reading candidates' portfolios,
  // observing teaching practice and tutor feedback to candidates, and holding
  // a provisional grading meeting with tutors", plus 14.2's meeting with
  // candidates without tutors present). Everything in it happens on the visit
  // date, so the date is the first test and the session kind is the second.
  //
  // "Feedback" as an exact title on a supervised_session is the timetable
  // skeleton's own convention, not a guess -- see FEEDBACK_AND_LESSON_PLANNING
  // in src/lib/timetable-skeleton.ts, and today-tab.tsx already matches the
  // same way.

  const eventMeta: Record<string, EventMeta> = {};
  for (const event of allEvents) {
    const mine = isAssessorViewer
      ? event.id === GRADING_MEETING_ID ||
        (event.event_date === assessorVisitDate &&
        (event.type === "tp" ||
          (event.type === "supervised_session" &&
            (event.title === "Feedback" || (event.title ?? "").toLowerCase().includes("assessor")))))
      : event.type !== "tp"
        ? true
        : ownedHalfOrders.size > 0 && (() => {
            const owningHalf = halfOwningDate(tpEventsForRotation, event.event_date);
            return owningHalf !== null && ownedHalfOrders.has(owningHalf);
          })();
    const volunteerAttendance =
      event.type === "tp" && volunteerIds.length > 0
        ? { total: volunteerIds.length, expected: volunteerIds.length - (declinedCountByEvent.get(event.id) ?? 0) }
        : null;
    eventMeta[event.id] = { mine, ownTpSlot: false, teachingLetters: null, volunteerAttendance };
  }

  return (
    <div className="flex flex-col gap-6">
      {editMode ? (
        <>
          <div className="sheet flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <BackLink href="/trainer/timetable" label="View timetable" />
              </div>
              <h1 className="mt-1 font-serif text-xl text-ink">Edit timetable</h1>
              {weekRange ? <p className="mt-1 font-serif text-2xl text-ink">{weekRange}</p> : null}
              <p className="mt-2 text-muted">
                The single source of truth for the course clock -- This Week, due dates, and TP
                dates all read from this.
              </p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              {locked ? (
                <form action={recomputeAssignmentDueDates}>
                  <button
                    type="submit"
                    title="Re-resolve Skills/LfC due dates against the current TP rotation and group pairing"
                    className="rounded-[6px] border border-border px-3.5 py-2 text-sm font-medium text-ink trainer-hover-fill"
                  >
                    Recompute due dates
                  </button>
                </form>
              ) : null}
              <form action={setTimetableLock}>
                <input type="hidden" name="lock" value={(!locked).toString()} />
                <button
                  type="submit"
                  className={`flex items-center gap-2 rounded-[6px] border px-4 py-2 text-sm font-medium ${
                    locked
                      ? "border-border text-ink trainer-hover-fill"
                      : "border-primary bg-primary text-primary-foreground"
                  }`}
                >
                  {!locked ? <span className="size-[5px] shrink-0 rounded-full bg-status-warning-text" /> : null}
                  {locked ? "Unlock timetable" : "Lock timetable"}
                </button>
              </form>
            </div>
          </div>

          {locked ? (
            <div className="sheet border-primary/20 bg-accent/30 text-sm text-ink">
              Locked -- the course clock now calculates off these dates. Unlock to make changes.
            </div>
          ) : null}

          {lock_error === "async_missing_link" ? (
            <div className="sheet border-destructive/30 bg-destructive/10 text-sm text-destructive">
              Can&apos;t lock -- an asynchronous input session has no linked live follow-up slot (Handbook
              3.4). Add the link on that session, or add the live slot first.
            </div>
          ) : null}

          {lock_error === "tp_double_booked" ? (
            <div className="sheet border-destructive/30 bg-destructive/10 text-sm text-destructive">
              Can&apos;t lock -- two TP rounds are scheduled on {lockErrorDate ?? "the same date"}, which means a
              candidate would be teaching twice in one day (Handbook 9.1.3). Move one of the rounds to a different date.
            </div>
          ) : null}

          {lock_error === "mode_not_blocked" ? (
            <div className="sheet border-destructive/30 bg-destructive/10 text-sm text-destructive">
              Can&apos;t lock -- {lockErrorHalf ? `group ${lockErrorHalf}'s` : "a group's"} TP rounds switch between
              face-to-face and online more than once (Handbook 3.5). Each half teaches one mode, then the other --
              not a mix. Check each TP round&apos;s mode in its detail panel.
            </div>
          ) : null}

          {lock_error === "intensive_no_break" ? (
            <div className="sheet border-destructive/30 bg-destructive/10 text-sm text-destructive">
              Can&apos;t lock -- {lockErrorRun ?? "several"} TP days in a row with no break (Handbook 9.1.3). No more
              than 6 consecutive TP days without a two-day break in the middle. Move a session to open a gap.
            </div>
          ) : null}

          {allEvents.length > 0 ? (
            <div className="sheet">
              <DragBoard
                events={allEvents}
                locked={locked}
                volunteers={volunteers ?? []}
                attendedByEvent={attendedByEvent}
                attendanceSourceByEvent={attendanceSourceByEvent}
                unmatchedByEvent={unmatchedByEvent}
                mixedMode={course?.delivery_mode === "mixed"}
                canEdit={isMct}
                timeZone={timeZone}
              />
            </div>
          ) : (
            <div className="sheet text-sm text-muted">No events yet.</div>
          )}

          {/* specs/build-spec.md §7 "Laptop only: ... editing the timetable." */}
          <LaptopOnlyGate task="Adding events, generating the skeleton, and time bands">
          {!locked ? (
            // Open by default only for a genuinely empty course -- otherwise a
            // brand-new course would strand the trainer with no visible way to
            // start (the skeleton generator is the only actionable content when
            // there's nothing on the grid yet). Every course that already has
            // events gets the collapsed default the spec asks for.
            <details className="sheet sheet-garnet" open={allEvents.length === 0}>
              <summary className="cursor-pointer font-serif text-lg text-ink">Course setup</summary>
              <div className="mt-4 flex flex-col gap-6">
                {allEvents.length === 0 ? (
                  <div>
                    <h3 className="font-serif text-base text-ink">Start from the standard skeleton</h3>
                    <p className="mt-1 text-sm text-muted">
                      Generates the usual 4-week CELTA shape -- 8 teaching practices, all 4 written
                      assignments, VO1-3, Stage 1 &amp; 2 tutorials -- anchored to a real start date. Nobody
                      builds a course from a blank grid: tweak or remove anything below afterwards.
                    </p>
                    <GenerateSkeletonForm />
                  </div>
                ) : null}

                <div className={allEvents.length === 0 ? "border-t border-border-faint pt-6" : ""}>
                  <TimeBandsForm timeBands={timeBands} isCustom={isCustomTimeBands} />
                </div>

                <div className="border-t border-border-faint pt-6">
                  <h3 className="font-serif text-base text-ink">Add event</h3>
                  <p className="mt-1 text-sm text-muted">
                    Add a single dated item to the timetable below -- an input session, a TP, an
                    assignment or resubmission due date, or a milestone.
                  </p>
                  <AddEventForm
                    existingEvents={allEvents.map((e) => ({ id: e.id, title: e.title, event_date: e.event_date }))}
                    tpGroups={tpGroups ?? []}
                  />
                </div>
              </div>
            </details>
          ) : null}
          </LaptopOnlyGate>
        </>
      ) : (
        <>
          {/* for-claude-code-timetable-edit-vs-view.md: this is what a
              trainer lands on now -- the day-to-day glance/join screen,
              same glass-card design as the trainee's read-only board
              (for-claude-code-timetable-view.md), reused as-is. */}
          {trainer ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <AlsoUnder tab="Timetable" links={[{ href: "/trainer/session-materials", label: "Share session materials" }]} />
              {isMct ? (
                <Link href="/trainer/timetable?mode=edit" className="text-sm font-medium text-primary hover:underline">
                  Edit timetable &rarr;
                </Link>
              ) : null}
            </div>
          ) : null}

          {allEvents.length === 0 ? (
            <div className="sheet text-sm text-muted">No events yet.</div>
          ) : (
            <ReadOnlyTimetableBoard
              events={allEvents}
              eventMeta={eventMeta}
              timeBands={timeBands}
              viewerName={trainer?.full_name ?? "Assessor"}
              mineMeaning={
                isAssessorViewer
                  ? assessorVisitDate
                    ? "\u201cMine\u201d is your visit: the teaching practice, the tutor feedback after it, and the meeting with the candidates. The grading meeting is not here \u2014 it is not on the candidates\u2019 timetable, and sits in the assessment timetable in your pack instead."
                    : "No visit date has been set yet, so \u201cMine\u201d has nothing to narrow to."
                  : undefined
              }
              viewerGroupLabel={viewerGroupLabel}
              today={today}
              nowIso={new Date().toISOString()}
              timeZone={timeZone}
            />
          )}
        </>
      )}

      {/* Stage 2/1/3 tutorial booking stays reachable regardless of mode or
          MCT status -- booking a candidate's tutorial slot is day-to-day
          tutor work, not a structure-editing action (open question flagged
          separately: for-claude-code-timetable-page-priority.md asked
          whether this should be MCT-only too; left open here). Still hidden
          for a touring assessor (for-claude-code-assessor-tour-mode.md) --
          these are booking forms, not something to invite a view-only
          visitor to click. */}
      {trainer ? (
      <LaptopOnlyGate task="Stage 2 group booking and Stage 1/3 individual invites">
      <Stage2Section groups={stage2Groups} blocks={stage2Blocks} />
      <IndividualTutorialSection stage="stage1" candidates={allCandidates} invites={stage1Invites} />
      <IndividualTutorialSection stage="stage3" candidates={stage3Candidates} invites={stage3Invites} />
      </LaptopOnlyGate>
      ) : null}
    </div>
  );
}


/**
 * Where the grading meeting sits on the assessor's own view of the day: after
 * the meeting with the candidates if that is timetabled, otherwise after the
 * feedback, otherwise the last band. Handbook 14.2/14.3's order -- observe,
 * feedback, candidates, then grades with the tutors.
 */
function gradingMeetingTime(
  events: TimetableEvent[],
  visitDate: string,
  courseTimeBands: TimeBand[] | null | undefined
): string {
  const bands = resolveTimeBands(courseTimeBands);
  const onDay = events.filter((e) => e.event_date === visitDate && e.event_time);
  const anchor = onDay
    .filter((e) => (e.title ?? "").toLowerCase().includes("assessor") || e.title === "Feedback")
    .map((e) => (e.event_time ?? "").slice(0, 5))
    .sort()
    .pop();
  if (!anchor) return bands[bands.length - 1].start;
  return bands.find((b) => b.start > anchor)?.start ?? bands[bands.length - 1].start;
}
