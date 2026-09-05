import Link from "next/link";
import { hubReadClient } from "@/lib/supabase/hub-read";
import { AlsoUnder } from "@/app/trainer/(hub)/also-under";
import { PageHead, HUB_BUTTON, HUB_PRIMARY, HUB_PRIMARY_STYLE } from "@/app/trainer/(hub)/page-head";
import { BackLink } from "@/components/back-link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMctView } from "@/lib/act-preview";
import { setTimetableLock, recomputeAssignmentDueDates } from "@/app/trainer/(hub)/timetable/actions";
import { AddEventForm } from "@/app/trainer/(hub)/timetable/add-event-form";
import { GenerateSkeletonForm } from "@/app/trainer/(hub)/timetable/generate-skeleton-form";
import { DragBoard, type UnmatchedParticipant } from "@/app/trainer/(hub)/timetable/drag-board";
import { TimeBandsForm } from "@/app/trainer/(hub)/timetable/time-bands-form";
import { resolveTimeBands, toLocalIso, DEFAULT_TIMEZONE, type TimetableEvent, type TimeBand } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { halfOwningDate, type TpTimetableEvent } from "@/lib/rotation";
import { ReadOnlyTimetableBoard, type EventMeta } from "@/app/portfolio/[traineeId]/timetable/read-only-board";
import { TutorialsSection } from "@/app/trainer/(hub)/timetable/tutorials-section";
import { shortDate, shortTime, stageForWeek, positionTime, type SheetSlot, type GridCell, type GroupSummary, type BlockSummary, type GridRow, type TutorialsSectionData } from "@/lib/tutorials-section";
import { computeWeekOf } from "@/lib/course-progress";
import { ordinal } from "@/lib/stage2-tutorials";
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
  const courseId = trainer?.course_id ?? assessorCourseId;
  const supabase = trainer ? hubReadClient(trainer, courseId!) : createAdminClient();
  if (!courseId) {
    return (
      <div className="sheet text-sm text-muted">No course assigned.</div>
    );
  }

  const [{ data: course }, { data: events }, { data: volunteers }] = await Promise.all([
    supabase.from("courses").select("name, timetable_locked_at, time_bands, delivery_mode, center_id, assessor_visit_date, start_date, end_date").eq("id", courseId).maybeSingle(),
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
  // Ramy, 2026-08-23: ACT doesn't make changes to the timetable, so doesn't
  // need to see those options -- mirrors actions.ts' requireTimetableEditAccess
  // exactly (same isMctOnCourse() check, admin bypass), so the UI never
  // offers a control the server would then reject.
  const isMct = Boolean(trainer) && (await isMctView(trainer!, courseId));
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

  // Wave 2: everything that needs only wave 1's ids, together. Perf audit
  // 5 Sep 2026: these used to be three separate batches plus two stragglers.
  // course_subgroup_members is scoped through this course's subgroups --
  // it used to be read with no filter at all, which on the assessor path
  // (admin client, no RLS) meant every subgroup member in the database.
  const tpEventIds = allEvents.filter((e) => e.type === "tp").map((e) => e.id);
  const [
    { data: attendanceRows },
    { data: unmatchedRows },
    { data: volunteerDeclines },
    { data: subgroups },
    { data: tpGroups },
    { data: blocks },
    { data: activeTrainees },
    { data: stage3Records },
    { data: invites },
    { data: consultationBlocks },
    { data: traineeAssignments },
  ] = await Promise.all([
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
    volunteerIds.length > 0
      ? supabase.from("volunteer_declines").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] as { volunteer_student_id: string; timetable_event_id: string }[] }),
    supabase.from("course_subgroups").select("id, name, tp_group_id, half_order").eq("course_id", courseId).order("created_at"),
    supabase.from("course_tp_groups").select("id, name, tutor_profile_id").eq("course_id", courseId),
    supabase.from("stage2_tutorial_blocks").select("id, tp_group_id, subgroup_id, timetable_event_id").eq("course_id", courseId),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee").eq("course_status", "active").order("full_name"),
    supabase.from("celta5_records").select("trainee_id, stage3_tutorial_required, stage1_completed_at, stage3_finalized_at").eq("course_id", courseId),
    supabase.from("individual_tutorial_invites").select("id, trainee_id, stage, timetable_event_id, confirmed_at").eq("course_id", courseId),
    // Consultation blocks (migration 0275) -- the tutorials section below.
    supabase.from("consultation_blocks").select("id, tutor_profile_id, timetable_event_id, slot_length_minutes").eq("course_id", courseId),
    supabase.from("assignments").select("trainee_id, assignment_type, first_submitted_at").eq("course_id", courseId),
  ]);
  // Wave 3: the positions behind every sheet, and the tutors' names.
  const stage2BlockIds = (blocks ?? []).map((b) => b.id);
  const consultationBlockIds = (consultationBlocks ?? []).map((b) => b.id);
  const tutorIds = [...new Set([...(tpGroups ?? []).map((g) => g.tutor_profile_id), ...(consultationBlocks ?? []).map((b) => b.tutor_profile_id)].filter((id): id is string => Boolean(id)))];
  const [{ data: stage2Slots }, { data: consultationSlots }, { data: tutorProfiles }, { data: courseTutors }] = await Promise.all([
    stage2BlockIds.length > 0
      ? supabase.from("stage2_tutorial_slots").select("block_id, position, trainee_id").in("block_id", stage2BlockIds).order("position")
      : Promise.resolve({ data: [] as { block_id: string; position: number; trainee_id: string | null }[] }),
    consultationBlockIds.length > 0
      ? supabase.from("consultation_slots").select("block_id, position, trainee_id, assignment_type").in("block_id", consultationBlockIds).order("position")
      : Promise.resolve({ data: [] as { block_id: string; position: number; trainee_id: string | null; assignment_type: string | null }[] }),
    tutorIds.length > 0 ? supabase.from("profiles").select("id, full_name").in("id", tutorIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    supabase.from("course_tutors").select("profile_id, profiles!inner(full_name)").eq("course_id", courseId).is("left_at", null),
  ]);
  const { data: subgroupMembers } =
    (subgroups ?? []).length > 0
      ? await supabase.from("course_subgroup_members").select("subgroup_id, trainee_id").in("subgroup_id", (subgroups ?? []).map((g) => g.id))
      : { data: [] as { subgroup_id: string; trainee_id: string }[] };
  const declinedCountByEvent = new Map<string, number>();
  for (const d of volunteerDeclines ?? []) {
    declinedCountByEvent.set(d.timetable_event_id, (declinedCountByEvent.get(d.timetable_event_id) ?? 0) + 1);
  }
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
  const blockEventById = new Map(allEvents.map((e) => [e.id, e]));

  // Same per-tutor scoping for Stage 1/3: a candidate is "the trainer's own"
  // if they're a member of a subgroup belonging to a TP group the trainer
  // tutors. A trainee in an unpaired subgroup has no owning tutor to test
  // against (same gap as above) -- left visible to every trainer.
  const ownedSubgroupIds = new Set((subgroups ?? []).filter((s) => s.tp_group_id && ownedGroupIds.has(s.tp_group_id)).map((s) => s.id));
  const unpairedSubgroupIds = new Set((subgroups ?? []).filter((s) => !s.tp_group_id).map((s) => s.id));

  // ---- Tutorials and consultations (design_handoff_tutorials_consultations) ----
  // Everything below the board, built here as plain data for the client
  // section: one summary row per group per stage, the consultation blocks,
  // and one grid row per candidate with a cell per stage + consultations.
  const tutorNameById = new Map((tutorProfiles ?? []).map((t) => [t.id, t.full_name]));
  const traineeNameById = new Map((activeTrainees ?? []).map((t) => [t.id, t.full_name]));
  const bookedIds = [...new Set([...(stage2Slots ?? []), ...(consultationSlots ?? [])].map((x) => x.trainee_id).filter((id): id is string => Boolean(id) && !traineeNameById.has(id as string)))];
  if (bookedIds.length > 0) {
    const { data: others } = await supabase.from("profiles").select("id, full_name").in("id", bookedIds);
    for (const o of others ?? []) traineeNameById.set(o.id, o.full_name);
  }
  const toSheetSlots = (rows: { position: number; trainee_id: string | null; assignment_type?: string | null }[], eventTime: string | null | undefined, slotMinutes: number): SheetSlot[] =>
    rows.map((x) => ({
      position: x.position,
      time: positionTime(eventTime, x.position, slotMinutes),
      traineeId: x.trainee_id,
      traineeName: x.trainee_id ? (traineeNameById.get(x.trainee_id) ?? "Unknown") : null,
      about: x.assignment_type ?? null,
    }));
  const subgroupById = new Map((subgroups ?? []).map((s) => [s.id, s]));
  const tpGroupById = new Map((tpGroups ?? []).map((g) => [g.id, g]));
  const membershipByTrainee = new Map((subgroupMembers ?? []).map((m) => [m.trainee_id, m.subgroup_id]));
  const celta5ByTrainee = new Map((stage3Records ?? []).map((r) => [r.trainee_id, r]));
  const inviteByTraineeStage = new Map((invites ?? []).map((i) => [`${i.trainee_id}:${i.stage}`, i]));
  const stage2SlotsByBlock = new Map<string, { position: number; trainee_id: string | null }[]>();
  for (const sl of stage2Slots ?? []) stage2SlotsByBlock.set(sl.block_id, [...(stage2SlotsByBlock.get(sl.block_id) ?? []), sl]);
  const consultationSlotsByBlock = new Map<string, { position: number; trainee_id: string | null; assignment_type: string | null }[]>();
  for (const sl of consultationSlots ?? []) consultationSlotsByBlock.set(sl.block_id, [...(consultationSlotsByBlock.get(sl.block_id) ?? []), sl]);
  const submittedByTrainee = new Map<string, string[]>();
  for (const a of traineeAssignments ?? []) {
    if (a.first_submitted_at) submittedByTrainee.set(a.trainee_id, [...(submittedByTrainee.get(a.trainee_id) ?? []), a.assignment_type]);
  }
  const whenLabel = (eventId: string, minutes?: number) => {
    const ev = blockEventById.get(eventId);
    if (!ev) return "";
    return `${shortDate(ev.event_date)} · ${shortTime(ev.event_time)}${minutes ? ` · ${minutes} min` : ""}`;
  };

  // Every group a candidate can belong to: paired TP groups (both halves)
  // and unpaired subgroups, each with its tutor (if any).
  type GroupDef = { scope: string; kind: "tpgroup" | "subgroup"; id: string; name: string; tutorId: string | null; own: boolean; memberIds: string[] };
  const groupDefs: GroupDef[] = [
    ...(tpGroups ?? [])
      .filter((g) => pairedTpGroupIds.has(g.id))
      .map((g) => ({
        scope: `tpgroup:${g.id}`,
        kind: "tpgroup" as const,
        id: g.id,
        name: g.name,
        tutorId: g.tutor_profile_id,
        own: isAdmin || ownedGroupIds.has(g.id),
        memberIds: (subgroupMembers ?? []).filter((m) => subgroupById.get(m.subgroup_id)?.tp_group_id === g.id).map((m) => m.trainee_id),
      })),
    ...(subgroups ?? [])
      .filter((sg) => !sg.tp_group_id)
      .map((sg) => ({
        scope: `subgroup:${sg.id}`,
        kind: "subgroup" as const,
        id: sg.id,
        name: sg.name,
        tutorId: null,
        own: true,
        memberIds: (subgroupMembers ?? []).filter((m) => m.subgroup_id === sg.id).map((m) => m.trainee_id),
      })),
  ];
  const activeIds = new Set((activeTrainees ?? []).map((t) => t.id));
  const stage2BlockByScope = new Map((blocks ?? []).map((b) => [b.tp_group_id ? `tpgroup:${b.tp_group_id}` : `subgroup:${b.subgroup_id}`, b]));

  const groupSummaries: GroupSummary[] = groupDefs.map((g) => {
    const members = g.memberIds.filter((id) => activeIds.has(id));
    const filed = members.filter((id) => celta5ByTrainee.get(id)?.stage1_completed_at).length;
    const confirmed = members.filter((id) => !celta5ByTrainee.get(id)?.stage1_completed_at && inviteByTraineeStage.get(`${id}:stage1`)?.confirmed_at).length;
    const pending = members.filter((id) => !celta5ByTrainee.get(id)?.stage1_completed_at && inviteByTraineeStage.has(`${id}:stage1`) && !inviteByTraineeStage.get(`${id}:stage1`)?.confirmed_at).length;
    const block = stage2BlockByScope.get(g.scope);
    const slots = block ? (stage2SlotsByBlock.get(block.id) ?? []) : [];
    return {
      scope: g.scope,
      name: g.name,
      own: g.own,
      stage1: { total: members.length, filed, confirmed, pending, notInvited: members.length - filed - confirmed - pending },
      stage2: block
        ? {
            blockId: block.id,
            when: whenLabel(block.timetable_event_id, slots.length * 15),
            booked: slots.filter((x) => x.trainee_id).length,
            total: slots.length,
            href: `/trainer/timetable/stage2/${block.id}`,
            slots: toSheetSlots(slots, blockEventById.get(block.timetable_event_id)?.event_time, 15),
          }
        : null,
      stage3: {
        flagged: members
          .filter((id) => celta5ByTrainee.get(id)?.stage3_tutorial_required && !celta5ByTrainee.get(id)?.stage3_finalized_at)
          .map((id) => ({ id, name: traineeNameById.get(id) ?? "Unknown", invited: inviteByTraineeStage.has(`${id}:stage3`) })),
      },
    };
  });

  const blockSummaries: BlockSummary[] = (consultationBlocks ?? [])
    .map((b) => {
      const slots = consultationSlotsByBlock.get(b.id) ?? [];
      return {
        id: b.id,
        tutorId: b.tutor_profile_id,
        tutorName: tutorNameById.get(b.tutor_profile_id) ?? "Tutor",
        when: whenLabel(b.timetable_event_id, slots.length * b.slot_length_minutes),
        booked: slots.filter((x) => x.trainee_id).length,
        total: slots.length,
        href: `/trainer/timetable/consultation/${b.id}`,
        mine: Boolean(trainer) && b.tutor_profile_id === trainer!.id,
        slotMinutes: b.slot_length_minutes,
        slots: toSheetSlots(slots, blockEventById.get(b.timetable_event_id)?.event_time, b.slot_length_minutes),
      };
    })
    .sort((a, b) => a.when.localeCompare(b.when));

  const inviteCell = (traineeId: string, name: string, stage: "stage1" | "stage3", own: boolean): GridCell => {
    const invite = inviteByTraineeStage.get(`${traineeId}:${stage}`);
    const ev = invite ? blockEventById.get(invite.timetable_event_id) : null;
    const action = {
      type: "invite" as const,
      stage,
      traineeId,
      traineeName: name,
      inviteId: invite?.id ?? null,
      date: ev?.event_date ?? null,
      time: ev?.event_time ? ev.event_time.slice(0, 5) : null,
    };
    if (!invite) return { kind: "move", main: stage === "stage1" ? "Invite" : "Flagged · invite", sub: stage === "stage1" ? "not yet invited" : "needs a Stage 3", action, viewOnly: !own };
    const main = ev ? `${shortDate(ev.event_date)} · ${shortTime(ev.event_time)}` : "Time set";
    return invite.confirmed_at ? { kind: "booked", main, sub: "confirmed", action, viewOnly: !own } : { kind: "waiting", main, sub: "awaiting confirmation", action, viewOnly: !own };
  };

  const gridRows: GridRow[] = (activeTrainees ?? []).map((t) => {
    const subgroupId = membershipByTrainee.get(t.id);
    const sg = subgroupId ? subgroupById.get(subgroupId) : null;
    const group = sg ? groupDefs.find((g) => (sg.tp_group_id ? g.id === sg.tp_group_id : g.id === sg.id)) : null;
    const tutorId = group?.tutorId ?? null;
    const own = isAdmin || !group || group.own;
    const record = celta5ByTrainee.get(t.id);

    // Stage 1: filed on the CELTA 5 beats any invite state.
    const stage1: GridCell = record?.stage1_completed_at
      ? { kind: "done", main: "Filed", sub: shortDate(record.stage1_completed_at.slice(0, 10)) }
      : inviteCell(t.id, t.full_name, "stage1", own);

    // Stage 2: the group's sheet, and this candidate's position on it.
    const block = group ? stage2BlockByScope.get(group.scope) : null;
    const slots = block ? (stage2SlotsByBlock.get(block.id) ?? []) : [];
    const mine = slots.find((x) => x.trainee_id === t.id);
    const openLeft = slots.filter((x) => !x.trainee_id).length;
    const blockEvent = block ? blockEventById.get(block.timetable_event_id) : null;
    const stage2: GridCell = !group
      ? { kind: "none", main: "—", sub: "no TP group yet" }
      : !block
        ? { kind: "move", main: "No sheet yet", sub: `${group.name} sheet not placed`, action: { type: "place-sheet", scope: group.scope, label: group.name }, viewOnly: !own }
        : mine
          ? { kind: "booked", main: `${ordinal(mine.position)} · ${blockEvent ? shortDate(blockEvent.event_date) : ""}`, sub: `${group.name} sheet`, sheet: { kind: "stage2", id: block.id } }
          : { kind: "waiting", main: "Not booked", sub: openLeft > 0 ? `sheet open, ${openLeft} position${openLeft === 1 ? "" : "s"} left` : "sheet full", sheet: { kind: "stage2", id: block.id } };

    // Stage 3: only for candidates the tutor has flagged.
    const stage3: GridCell = !record?.stage3_tutorial_required
      ? { kind: "none", main: "—", sub: "not flagged" }
      : record.stage3_finalized_at
        ? { kind: "done", main: "Done", sub: shortDate(record.stage3_finalized_at.slice(0, 10)) }
        : inviteCell(t.id, t.full_name, "stage3", own);

    // Consultations: this candidate's bookings across every block.
    const bookings = (consultationBlocks ?? [])
      .flatMap((b) => (consultationSlotsByBlock.get(b.id) ?? []).filter((x) => x.trainee_id === t.id).map(() => b))
      .map((b) => ({ b, date: blockEventById.get(b.timetable_event_id)?.event_date ?? "" }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = bookings.find((x) => x.date >= today) ?? bookings[bookings.length - 1];
    const submitted = submittedByTrainee.get(t.id) ?? [];
    const consult: GridCell = upcoming
      ? {
          kind: "booked",
          main: whenLabel(upcoming.b.timetable_event_id),
          sub: `with ${(tutorNameById.get(upcoming.b.tutor_profile_id) ?? "tutor").split(" ")[0]}${bookings.length > 1 ? ` · ${bookings.length - 1} more` : ""}`,
          sheet: { kind: "consultation", id: upcoming.b.id },
        }
      : { kind: "none", main: "None yet", sub: submitted.length > 0 ? `${submitted.join(", ")} submitted · own tutor only` : "any tutor until first submission" };

    return {
      id: t.id,
      name: t.full_name,
      groupName: group?.name ?? "No group",
      tutorName: tutorId ? (tutorNameById.get(tutorId) ?? "Tutor") : "No tutor",
      own,
      cells: [stage1, stage2, stage3, consult],
    };
  });

  const weekLabel = course?.start_date && course?.end_date ? computeWeekOf(course.start_date, course.end_date, today) : null;
  // The booking rule's worked example: a candidate who has submitted
  // something, named against a tutor who is not their own.
  const ruleExample = (() => {
    for (const t of activeTrainees ?? []) {
      const submitted = submittedByTrainee.get(t.id);
      if (!submitted?.length) continue;
      const sg = membershipByTrainee.get(t.id) ? subgroupById.get(membershipByTrainee.get(t.id)!) : null;
      const ownTutorId = sg?.tp_group_id ? (tpGroupById.get(sg.tp_group_id)?.tutor_profile_id ?? null) : null;
      const other = (consultationBlocks ?? []).find((b) => b.tutor_profile_id !== ownTutorId);
      if (!ownTutorId || !other) continue;
      return `${t.full_name} has submitted ${submitted[0]}, so ${tutorNameById.get(other.tutor_profile_id) ?? "another tutor"}'s sheet is closed to them for it and ${tutorNameById.get(ownTutorId) ?? "their own tutor"}'s is open.`;
    }
    return null;
  })();

  const tutorialsData: TutorialsSectionData = {
    viewerRole: isAdmin ? "admin" : isMct ? "mct" : "act",
    viewerId: trainer?.id ?? "",
    viewerName: trainer?.full_name ?? "",
    currentStage: stageForWeek(weekLabel),
    groups: groupSummaries,
    blocks: blockSummaries,
    rows: gridRows,
    tutors: (courseTutors ?? []).map((ct) => ({ id: ct.profile_id, name: (ct as unknown as { profiles: { full_name: string } }).profiles.full_name })),
    ruleExample,
  };

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

  const sheetHrefByEventId = new Map<string, string>([
    ...(blocks ?? []).map((b) => [b.timetable_event_id, `/trainer/timetable/stage2/${b.id}`] as [string, string]),
    ...(consultationBlocks ?? []).map((b) => [b.timetable_event_id, `/trainer/timetable/consultation/${b.id}`] as [string, string]),
  ]);
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
    eventMeta[event.id] = { mine, ownTpSlot: false, teachingLetters: null, volunteerAttendance,
      sheetHref: sheetHrefByEventId.get(event.id) ?? null,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      {editMode ? (
        <>
          <div className="flex flex-col gap-3">
            <BackLink href="/trainer/timetable" label="View timetable" />
            <PageHead
              eyebrow={`${course?.name ?? "Course"} · Timetable · editing`}
              title="Edit timetable"
              lede={
                <>
                  {weekRange ? <span className="font-serif text-lg text-ink">{weekRange}. </span> : null}
                  The single source of truth for the course clock -- This Week, due dates, and TP dates all read from this.
                </>
              }
            >
              <div className="hidden flex-wrap items-center gap-2 md:flex">
              {locked ? (
                <form action={recomputeAssignmentDueDates}>
                  <button
                    type="submit"
                    title="Re-resolve Skills/LfC due dates against the current TP rotation and group pairing"
                    className={HUB_BUTTON}
                  >
                    Recompute due dates
                  </button>
                </form>
              ) : null}
              <form action={setTimetableLock}>
                <input type="hidden" name="lock" value={(!locked).toString()} />
                <button
                  type="submit"
                  className={locked ? HUB_BUTTON : HUB_PRIMARY}
                  style={locked ? undefined : HUB_PRIMARY_STYLE}
                >
                  {!locked ? <span className="size-[5px] shrink-0 rounded-full bg-status-warning-text" /> : null}
                  {locked ? "Unlock timetable" : "Lock timetable"}
                </button>
              </form>
              </div>
            </PageHead>
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
          <PageHead eyebrow={`${course?.name ?? "Course"} · Timetable`} title={weekRange ?? "Timetable"}>
            {isMct ? (
              <Link href="/trainer/timetable?mode=edit" className={HUB_PRIMARY} style={HUB_PRIMARY_STYLE}>
                Edit timetable
              </Link>
            ) : null}
          </PageHead>
          {trainer ? <AlsoUnder tab="Timetable" links={[{ href: "/trainer/session-materials", label: "Share session materials" }]} /> : null}

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
      <TutorialsSection data={tutorialsData} />
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
