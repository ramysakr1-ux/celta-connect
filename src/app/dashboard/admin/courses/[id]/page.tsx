import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { JoinLinksCard } from "@/components/join-links-card";
import {
  CreateSubgroupForm,
  AddMemberForm,
} from "@/app/dashboard/admin/courses/[id]/subgroups-form";
import { removeSubgroupMember } from "@/app/dashboard/admin/courses/[id]/subgroup-actions";
import { removeRosterMember } from "@/app/dashboard/admin/courses/[id]/roster-actions";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">{course.name}</h1>
        <p className="mt-1 text-muted">
          {course.start_date} &rarr; {course.end_date}
        </p>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Roster</h2>
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
        <div className="mt-3 flex flex-col gap-4">
          {(subgroups ?? []).map((subgroup) => {
            const subgroupMembers = (members ?? []).filter((m) => m.subgroup_id === subgroup.id);
            return (
              <div key={subgroup.id} className="card p-6">
                <h3 className="font-serif text-ink">{subgroup.name}</h3>
                <div className="mt-3 flex flex-col gap-2">
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
                <div className="mt-4">
                  <AddMemberForm
                    courseId={course.id}
                    subgroupId={subgroup.id}
                    availableTrainees={unassignedTrainees.map((t) => ({
                      id: t.id,
                      full_name: t.full_name,
                    }))}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="card mt-4 p-6">
          <CreateSubgroupForm courseId={course.id} />
        </div>
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

      <JoinLinksCard
        courseId={course.id}
        traineeLink={`${process.env.SITE_URL ?? ""}/join/${course.trainee_join_token}`}
        trainerLink={`${process.env.SITE_URL ?? ""}/join/${course.trainer_join_token}`}
      />
    </div>
  );
}
