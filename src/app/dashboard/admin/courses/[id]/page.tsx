import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "@/app/dashboard/admin/courses/[id]/invite-form";

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

      <InviteForm courseId={course.id} />
    </div>
  );
}
