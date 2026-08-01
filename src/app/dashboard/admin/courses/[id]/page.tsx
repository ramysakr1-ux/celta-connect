import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "@/app/dashboard/admin/courses/[id]/invite-form";
import {
  CreateSubgroupForm,
  AddMemberForm,
} from "@/app/dashboard/admin/courses/[id]/subgroups-form";
import { removeSubgroupMember } from "@/app/dashboard/admin/courses/[id]/subgroup-actions";

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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-muted">
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

      <InviteForm courseId={course.id} />
    </div>
  );
}
