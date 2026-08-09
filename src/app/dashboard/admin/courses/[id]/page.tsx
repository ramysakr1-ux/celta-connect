import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { JoinLinksCard } from "@/components/join-links-card";
import {
  CreateSubgroupForm,
  AddMemberForm,
  PairSubgroupsForm,
  UnpairButton,
} from "@/app/dashboard/admin/courses/[id]/subgroups-form";
import { removeSubgroupMember } from "@/app/dashboard/admin/courses/[id]/subgroup-actions";
import { removeRosterMember, updateAssessorVisitDate } from "@/app/dashboard/admin/courses/[id]/roster-actions";
import { DuplicateCourseForm } from "@/app/dashboard/admin/courses/[id]/duplicate-course-form";
import { DeliveryModeCard } from "@/app/dashboard/admin/courses/[id]/delivery-mode-card";
import { computeWeekOf, computeCourseState } from "@/lib/course-progress";
import { toLocalIso } from "@/lib/timetable-grid";

export default async function CourseRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireRole("admin");
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!course || course.center_id !== admin.center_id) {
    notFound();
  }

  const { data: roster } = await supabase
    .from("profiles")
    .select("*")
    .eq("course_id", id)
    .order("role")
    .order("full_name");

  const { data: subgroups } = await supabase
    .from("course_subgroups")
    .select("*")
    .eq("course_id", id)
    .order("created_at");

  // checkpoint 3 -- TP groups pair two subgroups as "halves" that alternate
  // real TP days (see src/lib/rotation.ts). Kept as a separate query rather
  // than a join since course_tp_groups can exist with zero/one linked
  // subgroup mid-pairing-flow-edge-cases; simpler to read both flat and
  // join in JS.
  const { data: tpGroups } = await supabase.from("course_tp_groups").select("id, name").eq("course_id", id);

  const { data: members } = await supabase
    .from("course_subgroup_members")
    .select("id, subgroup_id, trainee_id, base_slot")
    .in("subgroup_id", (subgroups ?? []).map((g) => g.id))
    .order("base_slot");

  const nameByTraineeId = new Map((roster ?? []).map((m) => [m.id, m.full_name]));
  const assignedTraineeIds = new Set((members ?? []).map((m) => m.trainee_id));
  const unassignedTrainees = (roster ?? []).filter(
    (m) => m.role === "trainee" && !assignedTraineeIds.has(m.id)
  );

  // Read-only for admin -- the invite-link/add/remove management stays
  // trainer-owned (see /trainer/volunteers); admin just needs visibility
  // into attendance across any course at their center, not only "their
  // own" the way a trainer is scoped.
  const { data: volunteers } = await supabase
    .from("volunteer_students")
    .select("id, name")
    .eq("course_id", id)
    .is("removed_at", null)
    .order("name");
  const { data: tpEvents } = await supabase
    .from("course_timetable_events")
    .select("id")
    .eq("course_id", id)
    .eq("type", "tp");
  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const { data: attendanceRows } =
    volunteerIds.length > 0
      ? await supabase.from("volunteer_attendance").select("volunteer_student_id").in("volunteer_student_id", volunteerIds)
      : { data: [] };
  const attendanceCountByVolunteer = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    attendanceCountByVolunteer.set(row.volunteer_student_id, (attendanceCountByVolunteer.get(row.volunteer_student_id) ?? 0) + 1);
  }
  const totalTpSessions = tpEvents?.length ?? 0;

  const today = toLocalIso(new Date());
  const courseState = computeCourseState(course.start_date, course.end_date, today);
  const weekOf = courseState === "running" ? computeWeekOf(course.start_date, course.end_date, today) : null;
  const tutorCount = (roster ?? []).filter((m) => m.role === "trainer" || m.role === "admin").length;
  const candidateCount = (roster ?? []).filter((m) => m.role === "trainee").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-start justify-between gap-4 p-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
            {course.start_date} &ndash; {course.end_date}
            {weekOf ? ` · ${weekOf}` : ""}
          </p>
          <h1 className="mt-0.5 font-serif text-xl text-ink">{course.name}</h1>
        </div>
        <DuplicateCourseForm courseId={course.id} suggestedName={`${course.name} (copy)`} />
      </div>

      <DeliveryModeCard courseId={course.id} savedMode={course.delivery_mode} />

      <div className="card flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-serif text-lg text-ink">Assessor visit date</h2>
          <p className="mt-1 text-sm text-muted">
            Candidates get a calming reminder from Course Stream ahead of this date -- concerns are
            raised with the assessor in the meeting itself, not through a written channel.
          </p>
        </div>
        <form action={updateAssessorVisitDate} className="flex items-center gap-2">
          <input type="hidden" name="course_id" value={course.id} />
          <input
            type="date"
            name="assessor_visit_date"
            defaultValue={course.assessor_visit_date ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          <button type="submit" className="rounded-[6px] border border-border px-3 py-2 text-sm text-ink hover:border-primary">
            Save
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-lg text-ink">Roster</h2>
              <p className="text-xs text-muted">
                {tutorCount} tutor{tutorCount === 1 ? "" : "s"} &middot; {candidateCount} candidate
                {candidateCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="card mt-3 overflow-hidden">
              <table className="table-plain w-full">
                <thead>
                  <tr>
                    <th className="text-sm text-muted">Name</th>
                    <th className="text-sm text-muted">Email</th>
                    <th className="text-sm text-muted">Role</th>
                    <th className="text-sm text-muted"></th>
                  </tr>
                </thead>
                <tbody>
                  {roster && roster.length > 0 ? (
                    roster.map((member) => (
                      <tr key={member.id}>
                        <td className="text-ink">{member.full_name}</td>
                        <td className="text-muted">{member.email}</td>
                        <td>
                          <span className="status-pill status-pill-pending capitalize">
                            {member.role}
                          </span>
                        </td>
                        <td>
                          <form action={removeRosterMember}>
                            <input type="hidden" name="member_id" value={member.id} />
                            <input type="hidden" name="course_id" value={course.id} />
                            <button type="submit" className="text-sm text-destructive underline">
                              Remove
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-muted">
                        No one on this course yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-serif text-lg text-ink">Teaching Practice subgroups</h2>
            <p className="mt-1 text-sm text-muted">
              Trainees are split into fixed subgroups by teaching day; membership stays fixed for the
              course. Trainers manage rotation order from their own Rotation page.
            </p>
            {unassignedTrainees.length > 0 ? (
              <div className="mt-3 flex items-start gap-2.5 rounded-[6px] border border-gold/30 bg-gold/10 px-4 py-3">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold" />
                <p className="text-sm text-ink">
                  {unassignedTrainees.length} candidate{unassignedTrainees.length === 1 ? "" : "s"} aren&apos;t in a
                  group yet. The rotation can&apos;t be released until every candidate is placed.
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-4">
              {(() => {
                const availableTraineeOptions = unassignedTrainees.map((t) => ({ id: t.id, full_name: t.full_name }));
                const renderSubgroup = (subgroup: NonNullable<typeof subgroups>[number]) => {
                  const subgroupMembers = (members ?? []).filter((m) => m.subgroup_id === subgroup.id);
                  return (
                    <div key={subgroup.id}>
                      <h4 className="text-sm font-semibold text-ink">{subgroup.name}</h4>
                      <div className="mt-2 flex flex-col gap-2">
                        {subgroupMembers.length > 0 ? (
                          subgroupMembers.map((m) => (
                            <div key={m.id} className="flex items-center justify-between">
                              <span className="text-ink">{nameByTraineeId.get(m.trainee_id)}</span>
                              <form action={removeSubgroupMember}>
                                <input type="hidden" name="member_id" value={m.id} />
                                <input type="hidden" name="course_id" value={course.id} />
                                <button type="submit" className="text-sm text-destructive underline">
                                  Remove
                                </button>
                              </form>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted">No trainees in this subgroup yet.</p>
                        )}
                      </div>
                      <div className="mt-3">
                        <AddMemberForm courseId={course.id} subgroupId={subgroup.id} availableTrainees={availableTraineeOptions} />
                      </div>
                    </div>
                  );
                };

                const paired = (subgroups ?? []).filter((g) => g.tp_group_id);
                const unpaired = (subgroups ?? []).filter((g) => !g.tp_group_id);

                return (
                  <>
                    {(tpGroups ?? []).map((tpGroup) => {
                      const halves = paired
                        .filter((g) => g.tp_group_id === tpGroup.id)
                        .sort((a, b) => (a.half_order ?? 0) - (b.half_order ?? 0));
                      return (
                        <div key={tpGroup.id} className="card p-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-serif text-ink">{tpGroup.name}</h3>
                            <UnpairButton courseId={course.id} tpGroupId={tpGroup.id} />
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            The two halves alternate which real TP day (from the timetable) they teach on.
                          </p>
                          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                            {halves.map((half, i) => (
                              <div key={half.id}>
                                <p className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                                  Half {i === 0 ? "A" : "B"}
                                </p>
                                {renderSubgroup(half)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {unpaired.map((subgroup) => (
                      <div key={subgroup.id} className="card p-6">
                        {renderSubgroup(subgroup)}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
            <div className="card mt-4 flex flex-col gap-4 p-6">
              <CreateSubgroupForm courseId={course.id} />
              <PairSubgroupsForm
                courseId={course.id}
                unpairedSubgroups={(subgroups ?? []).filter((g) => !g.tp_group_id).map((g) => ({ id: g.id, name: g.name }))}
              />
            </div>
          </div>
        </div>

        <JoinLinksCard
          courseId={course.id}
          traineeLink={`${process.env.SITE_URL ?? ""}/join/${course.trainee_join_token}`}
          trainerLink={`${process.env.SITE_URL ?? ""}/join/${course.trainer_join_token}`}
        />
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Volunteer students (TP students)</h2>
        <p className="mt-1 text-sm text-muted">
          {(volunteers ?? []).length} registered · managed by the trainer from their Volunteers page.
        </p>
        <div className="card mt-3 overflow-hidden">
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">Name</th>
                <th className="text-sm text-muted">Sessions attended</th>
              </tr>
            </thead>
            <tbody>
              {volunteers && volunteers.length > 0 ? (
                volunteers.map((v) => (
                  <tr key={v.id}>
                    <td className="text-ink">{v.name}</td>
                    <td className="text-muted">
                      {attendanceCountByVolunteer.get(v.id) ?? 0} / {totalTpSessions}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="text-muted">
                    No volunteer students registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
