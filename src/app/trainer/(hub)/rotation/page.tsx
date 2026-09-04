import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rotationPosition, distinctTpDates, halfOwningDate, checkIntensiveTpBreaks, tpBlockEndsOnFinalDay } from "@/lib/rotation";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { ReorderForm } from "@/app/trainer/(hub)/rotation/reorder-form";
import { ScheduleForm } from "@/app/trainer/(hub)/rotation/schedule-form";
import { AssignButton } from "@/app/trainer/(hub)/rotation/assign-button";
import { TpGroupBoard } from "@/app/trainer/(hub)/rotation/tp-group-board";
import { RunningOrderPanel } from "@/app/trainer/(hub)/rotation/running-order-panel";
import { RevealPeerNotesForm } from "@/app/trainer/(hub)/rotation/reveal-peer-notes-form";
import { ClassGroupingForm } from "@/app/trainer/(hub)/rotation/class-grouping-form";
import { AimConstraintsForm } from "@/app/trainer/(hub)/rotation/aim-constraints-form";
import { RotationTabs } from "@/app/trainer/(hub)/rotation/rotation-tabs";
import { CreateSubgroupForm, PairSubgroupsForm, UnpairButton, AddMemberForm } from "@/app/dashboard/admin/courses/[id]/subgroups-form";
import { RemoveMemberButton } from "@/app/trainer/(hub)/rotation/remove-member-button";
import { GroupTutorForm } from "@/app/dashboard/admin/courses/[id]/group-tutor-form";
import { COURSE_STATUS_LABEL, isCourseStatusReadOnly } from "@/lib/course-status";
import { LaptopOnlyGate } from "@/components/laptop-only-gate";
import type { CourseStatus } from "@/lib/supabase/types";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6];

export default async function TrainerRotationPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();
  const courseId = trainer.course_id!;

  const { data: subgroups } = await supabase
    .from("course_subgroups")
    .select("id, name, tp_group_id, half_order")
    .eq("course_id", courseId)
    .order("created_at");

  const { data: tpGroups } = await supabase
    .from("course_tp_groups")
    .select("id, name, tutor_profile_id, meeting_days")
    .eq("course_id", courseId);

  // Any trainer on the course can own a TP group -- setTpGroupTutor's own
  // comment: "Ramy was clear that the MCT/ACT distinction governs
  // announcements, not teaching."
  const { data: courseTutorsForGroups } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainer")
    .order("full_name");

  // The tutor plan per group (migration 0268) and where the course is in
  // its TPs, for the "now" line. Admin client for the plan: set_by names
  // can be tutors no longer on the course.
  const [{ data: tutorPlanRows }, { data: currentTpRaw }] = await Promise.all([
    createAdminClient()
      .from("course_tp_group_tutors")
      .select("id, tp_group_id, tutor_profile_id, from_tp_number, set_by_profile_id, set_at, note")
      .eq("course_id", courseId)
      .is("superseded_at", null),
    supabase.rpc("current_tp_number", { p_course_id: courseId }),
  ]);
  const currentTp = typeof currentTpRaw === "number" ? currentTpRaw : 0;
  const planPeopleIds = [...new Set((tutorPlanRows ?? []).flatMap((r) => [r.tutor_profile_id, r.set_by_profile_id]).filter((x): x is string => Boolean(x)))];
  const { data: planPeople } = planPeopleIds.length
    ? await createAdminClient().from("profiles").select("id, full_name").in("id", planPeopleIds)
    : { data: [] };
  const planNameById = new Map((planPeople ?? []).map((p) => [p.id, p.full_name]));

  const { data: members } = await supabase
    .from("course_subgroup_members")
    .select("id, subgroup_id, trainee_id, base_slot")
    .in("subgroup_id", (subgroups ?? []).map((g) => g.id))
    .order("base_slot");

  const assignedTraineeIds = new Set((members ?? []).map((m) => m.trainee_id));

  const { data: roster } = await supabase
    .from("profiles")
    .select("id, full_name, course_status")
    .eq("course_id", courseId)
    .eq("role", "trainee");

  const nameByTraineeId = new Map((roster ?? []).map((r) => [r.id, r.full_name]));
  const courseStatusByTraineeId = new Map((roster ?? []).map((r) => [r.id, r.course_status]));
  const availableTrainees = (roster ?? [])
    .filter((r) => !assignedTraineeIds.has(r.id))
    .map((r) => ({ id: r.id, full_name: r.full_name }));

  // Handbook 3.7: "TP must be split evenly between the two tutors." Real
  // signal is who actually GAVE feedback (tp_feedback.trainer_id), not
  // course_tp_groups.tutor_profile_id -- a group's named tutor and who
  // ends up submitting a given round's feedback can differ in practice
  // (covering for a colleague, a TinT's supervisor stepping in). Advisory
  // only, same pattern as the double-booking warning on Course Admin.
  const { data: feedbackRows } = (roster ?? []).length
    ? await supabase
        .from("tp_feedback")
        .select("trainer_id")
        .in("trainee_id", (roster ?? []).map((r) => r.id))
        .not("trainer_id", "is", null)
        .not("submitted_at", "is", null)
    : { data: [] };
  const feedbackCountByTrainer = new Map<string, number>();
  for (const row of feedbackRows ?? []) {
    if (!row.trainer_id) continue;
    feedbackCountByTrainer.set(row.trainer_id, (feedbackCountByTrainer.get(row.trainer_id) ?? 0) + 1);
  }
  const { data: courseTrainers } =
    feedbackCountByTrainer.size > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", [...feedbackCountByTrainer.keys()])
      : { data: [] };
  const trainerNameById = new Map((courseTrainers ?? []).map((t) => [t.id, t.full_name]));
  const tpDistribution = [...feedbackCountByTrainer.entries()]
    .map(([trainerId, count]) => ({ name: trainerNameById.get(trainerId) ?? "Unknown", count }))
    .sort((a, b) => b.count - a.count);
  const tpDistributionUneven =
    tpDistribution.length >= 2 && tpDistribution[0].count - tpDistribution[tpDistribution.length - 1].count >= 3;

  const { data: coursebooks } = await supabase
    .from("tp_coursebooks")
    .select("id, title, level")
    .eq("center_id", trainer.center_id)
    .order("title");

  const { data: schedule } = await supabase
    .from("course_tp_schedule")
    .select("tp_number, tp_coursebook_id")
    .eq("course_id", courseId);

  const coursebookByTpNumber = new Map((schedule ?? []).map((s) => [s.tp_number, s.tp_coursebook_id]));

  const { data: plans } = await supabase
    .from("plan_assignments")
    .select("id, trainee_id, tp_number, taught_at, rotation_position_used, main_lesson_aim, aim_type, class_grouping")
    .eq("course_id", courseId);

  // connect-spec-corrections-for-claude-code.md item 10: whichever trainee
  // (if any) already carries this course's one allowed 1-to-1/small-group
  // TP, for the read-only tag below -- migration 0182's partial unique
  // index is the real cap, this is just surfacing it.
  const oneToOnePlan = (plans ?? []).find((p) => p.class_grouping === "one_to_one_or_small_group");

  const planByTraineeAndTp = new Map((plans ?? []).map((p) => [`${p.trainee_id}-${p.tp_number}`, p]));

  // checkpoint 3 -- real TP-day dates a paired TP group's halves alternate
  // across, derived from the actual timetable (not a stored weekday
  // setting -- see src/lib/rotation.ts).
  const { data: tpEvents } = await supabase
    .from("course_timetable_events")
    .select("event_date")
    .eq("course_id", courseId)
    .eq("type", "tp");
  const tpEventRows = tpEvents ?? [];
  const timeZone = (await getCachedCenter(trainer.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);

  // Handbook 9.1.3: "two-day minimum break midway, no more than six
  // consecutive TP days." The break-check only means something once a
  // course actually looks like an intensive block (a normal 2-3x/week
  // course always has gaps) -- gated on the run already being long enough
  // to read as intensive, so a typical course never sees a false flag.
  const intensiveCheck = checkIntensiveTpBreaks(distinctTpDates(tpEventRows));
  const looksIntensive = intensiveCheck.longestConsecutiveRun >= 4;

  // connect-spec-corrections-for-claude-code.md item 2: "a TP block should
  // not end on the course's final day" -- flagged, not blocked.
  const { data: courseSettings } = await supabase
    .from("courses")
    .select("end_date, tp7_allowed_aim_types, tp8_allowed_aim_types")
    .eq("id", courseId)
    .maybeSingle();
  const endsOnFinalDay = tpBlockEndsOnFinalDay(distinctTpDates(tpEventRows), courseSettings?.end_date ?? null);

  const buildMembers = (subgroupId: string) =>
    (members ?? [])
      .filter((m) => m.subgroup_id === subgroupId)
      .map((m) => ({
        memberId: m.id,
        traineeId: m.trainee_id,
        fullName: nameByTraineeId.get(m.trainee_id) ?? "Unknown",
        baseSlot: m.base_slot,
        courseStatus: courseStatusByTraineeId.get(m.trainee_id) ?? "active",
      }));

  const paired = (subgroups ?? []).filter((g) => g.tp_group_id);
  const unpaired = (subgroups ?? []).filter((g) => !g.tp_group_id);

  const complianceWarnings = (
    <>
      {looksIntensive ? (
        <div className="sheet p-6">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Intensive TP block</p>
          <p className="mt-1 text-xs text-muted">Handbook 9.1.3: a two-day minimum break midway, no more than six consecutive TP days.</p>
          <p className="mt-2 text-sm text-ink">Longest run so far: {intensiveCheck.longestConsecutiveRun} consecutive TP days.</p>
          {intensiveCheck.exceedsMaxConsecutive ? (
            <p className="mt-1 text-xs text-status-warning-text">Over six days in a row -- worth a look.</p>
          ) : null}
          {!intensiveCheck.hasTwoDayBreak ? (
            <p className="mt-1 text-xs text-status-warning-text">No two-day break anywhere in the schedule yet.</p>
          ) : null}
        </div>
      ) : null}

      {endsOnFinalDay ? (
        <div className="sheet bg-status-warning-bg p-6">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-status-warning-text uppercase">
            TP block ends on the final day
          </p>
          <p className="mt-1 text-sm text-status-warning-text">
            The last scheduled TP day lands on the course&apos;s own final day (Handbook 9.1.4). Worth moving it
            earlier so the final day isn&apos;t also someone&apos;s last assessed lesson.
          </p>
        </div>
      ) : null}

      {tpDistribution.length >= 2 ? (
        <div className="sheet p-6">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">TP feedback given, per tutor</p>
          <p className="mt-1 text-xs text-muted">Handbook 3.7: TP should be split evenly between the two tutors.</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {tpDistribution.map((t) => (
              <span key={t.name} className="text-sm text-ink">
                {t.name}: <span className="font-semibold tabular-nums">{t.count}</span>
              </span>
            ))}
          </div>
          {tpDistributionUneven ? (
            <p className="mt-2 text-xs text-status-warning-text">Uneven so far -- worth a look before the round ends.</p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const boardSection = (
    <>
      <div className="sheet p-6">
        {(subgroups ?? []).length === 0 ? (
          <p className="mb-3 text-muted">No subgroups yet -- create one below to get started.</p>
        ) : null}
        <CreateSubgroupForm courseId={courseId} />
      </div>

      {/* Paired TP groups -- the real board + running order, per checkpoint 3 */}
      {(tpGroups ?? []).map((tpGroup) => {
        const halves = paired
          .filter((g) => g.tp_group_id === tpGroup.id)
          .sort((a, b) => (a.half_order ?? 0) - (b.half_order ?? 0));
        if (halves.length !== 2) {
          // Not reachable via the admin UI today, but the DB doesn't
          // prevent it -- fall back to the plain per-subgroup board rather
          // than assuming both halves exist.
          return halves.map((g) => (
            <UnpairedSubgroupBoard
              key={g.id}
              courseId={courseId}
              subgroupId={g.id}
              name={g.name}
              members={buildMembers(g.id)}
              availableTrainees={availableTrainees}
              planByTraineeAndTp={planByTraineeAndTp}
            />
          ));
        }

        const boardHalves = halves.map((g) => ({
          subgroupId: g.id,
          halfOrder: g.half_order as 1 | 2,
          members: buildMembers(g.id),
        }));

        const allDates = distinctTpDates(tpEventRows);
        const nextDate = allDates.find((d) => d >= today) ?? null;
        const owningHalfOrder = nextDate ? halfOwningDate(tpEventRows, nextDate) : null;
        const nextHalf = owningHalfOrder ? boardHalves.find((h) => h.halfOrder === owningHalfOrder) : null;
        const nextHalfDateIndex = nextDate ? Math.floor(allDates.indexOf(nextDate) / 2) : -1;
        const nextTpNumber = nextHalfDateIndex + 1;

        return (
          <div key={tpGroup.id} className="flex flex-col gap-4">
            <TpGroupBoard
              groupName={tpGroup.name}
              halves={boardHalves}
              tpEvents={tpEventRows}
              plansByKey={
                new Map(
                  (plans ?? []).map((p) => [`${p.trainee_id}-${p.tp_number}`, { taughtAt: p.taught_at }])
                )
              }
              today={today}
            />

            <div className="sheet flex flex-wrap items-end justify-between gap-3 p-4">
              <div className="flex-1">
                <p className="mb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase">Group tutor</p>
                <GroupTutorForm
                  groupId={tpGroup.id}
                  courseId={courseId}
                  tutors={(courseTutorsForGroups ?? []).map((t) => ({ id: t.id, name: t.full_name }))}
                  assignments={(tutorPlanRows ?? [])
                    .filter((r) => r.tp_group_id === tpGroup.id)
                    .map((r) => ({
                      id: r.id,
                      tutorId: r.tutor_profile_id,
                      tutorName: planNameById.get(r.tutor_profile_id) ?? "Unknown",
                      fromTp: r.from_tp_number,
                      setByName: r.set_by_profile_id ? (planNameById.get(r.set_by_profile_id) ?? null) : null,
                      setAt: r.set_at,
                      note: r.note,
                    }))}
                  currentTutorName={tpGroup.tutor_profile_id ? (planNameById.get(tpGroup.tutor_profile_id) ?? (courseTutorsForGroups ?? []).find((t) => t.id === tpGroup.tutor_profile_id)?.full_name ?? null) : null}
                  currentTp={currentTp}
                  currentMeetingDays={tpGroup.meeting_days}
                />
              </div>
              <UnpairButton courseId={courseId} tpGroupId={tpGroup.id} />
            </div>

            {nextHalf && nextDate && nextTpNumber >= 1 && nextTpNumber <= 6 ? (
              <RunningOrderPanel
                subgroupId={nextHalf.subgroupId}
                halfLabel={nextHalf.halfOrder === 1 ? "A" : "B"}
                members={nextHalf.members}
                nextDate={nextDate}
                tpNumber={nextTpNumber}
                hasSchedule={coursebookByTpNumber.has(nextTpNumber) && Boolean(coursebookByTpNumber.get(nextTpNumber))}
                allPlans={(plans ?? [])
                  .filter((p) => nextHalf.members.some((m) => m.traineeId === p.trainee_id))
                  .map((p) => ({
                    traineeId: p.trainee_id,
                    tpNumber: p.tp_number,
                    taughtAt: p.taught_at,
                    rotationPositionUsed: p.rotation_position_used,
                    mainLessonAim: p.main_lesson_aim,
                    aimType: p.aim_type,
                    classGrouping: p.class_grouping,
                  }))}
              />
            ) : (
              <div className="sheet p-5 text-sm text-muted">
                No upcoming TP day scheduled -- add one on the Timetable page.
              </div>
            )}
          </div>
        );
      })}

      {/* Unpaired subgroups -- unchanged, exactly as before checkpoint 3 */}
      {unpaired.map((subgroup) => (
        <UnpairedSubgroupBoard
          key={subgroup.id}
          courseId={courseId}
          subgroupId={subgroup.id}
          name={subgroup.name}
          members={buildMembers(subgroup.id)}
          availableTrainees={availableTrainees}
          planByTraineeAndTp={planByTraineeAndTp}
        />
      ))}

      {unpaired.length >= 2 ? (
        <div className="sheet p-6">
          <PairSubgroupsForm courseId={courseId} unpairedSubgroups={unpaired.map((g) => ({ id: g.id, name: g.name }))} />
        </div>
      ) : null}
    </>
  );

  const peerNotesSection = (
    <div className="sheet p-6">
      <h2 className="font-serif text-lg text-ink">Peer observation notes</h2>
      <p className="mt-1 text-sm text-muted">
        Reveal a TP day&apos;s peer notes for everyone at once -- notes stay private until you do.
        Nothing to reveal for a lesson nobody has noted yet.
      </p>
      <div className="mt-3">
        <RevealPeerNotesForm subgroups={(subgroups ?? []).map((g) => ({ id: g.id, name: g.name }))} />
      </div>
    </div>
  );

  const oneToOneSection = (
    <div className="sheet p-6">
      <h2 className="font-serif text-lg text-ink">1-to-1 / small-group TP</h2>
      <p className="mt-1 text-sm text-muted">
        Handbook: one of the six assessed TP lessons may be given to a single or paired student instead of the
        whole class, planned in advance -- never the final two (TP7/TP8), and only one per candidate for the
        course.
      </p>
      {oneToOnePlan ? (
        <p className="mt-3 text-sm text-ink">
          Currently: <span className="font-semibold">{nameByTraineeId.get(oneToOnePlan.trainee_id) ?? "Unknown"}</span>,{" "}
          TP{oneToOnePlan.tp_number}.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">No trainee has a 1-to-1/small-group TP set yet.</p>
      )}
      <div className="mt-4">
        <ClassGroupingForm trainees={roster ?? []} />
      </div>
    </div>
  );

  const aimConstraintsSection = (
    <div className="sheet p-6">
      <h2 className="font-serif text-lg text-ink">TP7/8 aim-type constraints</h2>
      <p className="mt-1 text-sm text-muted">
        TP7 and TP8 aren&apos;t rotation-assigned -- trainees pick their own topic. Restrict which main-aim types
        are on offer for each slot, if you want to. Coverage and remediation suggestions shown to trainees always
        stay inside whatever you set here.
      </p>
      <div className="mt-4">
        <AimConstraintsForm
          tp7AllowedAimTypes={courseSettings?.tp7_allowed_aim_types ?? null}
          tp8AllowedAimTypes={courseSettings?.tp8_allowed_aim_types ?? null}
        />
      </div>
    </div>
  );

  const coursebookSection = (
    <div className="sheet p-6">
      <h2 className="font-serif text-lg text-ink">Coursebook schedule</h2>
      <p className="mt-1 text-sm text-muted">
        Which coursebook&apos;s TP Points Library feeds each TP number.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {TP_NUMBERS.map((tpNumber) => (
          <ScheduleForm
            key={tpNumber}
            tpNumber={tpNumber}
            coursebooks={coursebooks ?? []}
            currentCoursebookId={coursebookByTpNumber.get(tpNumber) ?? null}
          />
        ))}
      </div>
    </div>
  );

  return (
    <LaptopOnlyGate task="Teaching Practice rotation">
    <div className="flex flex-col gap-6">
      <div className="sheet flex items-start justify-between gap-4 p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">Teaching Practice rotation</h1>
          <p className="mt-2 text-muted">
            Manage each subgroup&apos;s rotation order, schedule which coursebook feeds each TP
            number, and assign a round once library content is published.
          </p>
        </div>
        <Link
          href="/trainer/rotation/override"
          className="shrink-0 rounded-[6px] border border-border px-3.5 py-2 text-sm font-medium text-ink trainer-hover-fill"
        >
          Manual override →
        </Link>
      </div>

      {complianceWarnings}

      <RotationTabs
        board={boardSection}
        peerNotes={peerNotesSection}
        oneToOne={oneToOneSection}
        aimConstraints={aimConstraintsSection}
        coursebooks={coursebookSection}
      />
    </div>
    </LaptopOnlyGate>
  );
}

// The original (pre-checkpoint-3) per-subgroup board, kept verbatim for any
// subgroup that hasn't been paired into a TP group yet -- existing courses
// must keep rendering exactly as they did before this checkpoint.
function UnpairedSubgroupBoard({
  courseId,
  subgroupId,
  name,
  members,
  availableTrainees,
  planByTraineeAndTp,
}: {
  courseId: string;
  subgroupId: string;
  name: string;
  members: { memberId: string; traineeId: string; fullName: string; baseSlot: number; courseStatus: CourseStatus }[];
  availableTrainees: { id: string; full_name: string }[];
  planByTraineeAndTp: Map<string, { taught_at: string | null; class_grouping: "whole_class" | "one_to_one_or_small_group" }>;
}) {
  const size = members.length;

  return (
    <div className="sheet flex flex-col gap-6 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">{name}</h2>
        {size > 0 ? (
          <>
            <div className="mt-3">
              <ReorderForm subgroupId={subgroupId} members={members} />
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {members.map((m) => (
                <li key={m.memberId} className="flex items-center gap-1.5 text-sm text-ink">
                  {m.fullName}
                  <RemoveMemberButton courseId={courseId} memberId={m.memberId} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">No trainees in this subgroup yet.</p>
        )}
        <div className="mt-3">
          <AddMemberForm courseId={courseId} subgroupId={subgroupId} availableTrainees={availableTrainees} />
        </div>
      </div>

      {size > 0 ? (
        <div>
          <h3 className="text-sm text-muted">Teaching order preview</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="table-plain w-full">
              <thead>
                <tr>
                  <th className="text-sm text-muted">TP</th>
                  <th className="text-sm text-muted">Teaching order</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {TP_NUMBERS.map((tpNumber) => {
                  const order = [...members].sort(
                    (a, b) => rotationPosition(a.baseSlot, size, tpNumber) - rotationPosition(b.baseSlot, size, tpNumber)
                  );
                  return (
                    <tr key={tpNumber}>
                      <td className="text-ink">TP{tpNumber}</td>
                      <td className="text-ink">{order.map((m) => m.fullName).join(", ")}</td>
                      <td>
                        <AssignButton subgroupId={subgroupId} tpNumber={tpNumber} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {size > 0 ? (
        <div>
          <h3 className="text-sm text-muted">Progress</h3>
          <p className="mt-1 text-xs text-muted">
            Logging a trainee&apos;s TP lesson (on their trainee page) unlocks assigning
            their next one -- keeps the Plan page to one upcoming lesson at a time.
          </p>
          <div className="mt-2 overflow-x-auto">
            <table className="table-plain w-full">
              <thead>
                <tr>
                  <th className="text-sm text-muted">Trainee</th>
                  {TP_NUMBERS.map((tpNumber) => (
                    <th key={tpNumber} className="text-sm text-muted">
                      TP{tpNumber}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.traineeId}>
                    <td className="text-ink">
                      {member.fullName}
                      {member.courseStatus === "extension" ? <span className="pill pill-info ml-2">Extension</span> : null}
                    </td>
                    {TP_NUMBERS.map((tpNumber) => {
                      const plan = planByTraineeAndTp.get(`${member.traineeId}-${tpNumber}`);
                      if (isCourseStatusReadOnly(member.courseStatus)) {
                        return (
                          <td key={tpNumber}>
                            {plan?.taught_at ? (
                              <span className="status-pill status-pill-on-track">Taught</span>
                            ) : (
                              <span className="pill pill-neutral">{COURSE_STATUS_LABEL[member.courseStatus]}</span>
                            )}
                          </td>
                        );
                      }
                      if (!plan) {
                        return (
                          <td key={tpNumber} className="text-sm text-muted">
                            &mdash;
                          </td>
                        );
                      }
                      const oneToOneTag =
                        plan.class_grouping === "one_to_one_or_small_group" ? (
                          <span className="pill pill-info ml-1.5 text-[10px]">1-to-1</span>
                        ) : null;
                      if (plan.taught_at) {
                        return (
                          <td key={tpNumber}>
                            <span className="status-pill status-pill-on-track">Taught</span>
                            {oneToOneTag}
                          </td>
                        );
                      }
                      return (
                        <td key={tpNumber} className="text-sm text-muted">
                          Awaiting lesson log
                          {oneToOneTag}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
