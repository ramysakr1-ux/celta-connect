import { createAdminClient } from "@/lib/supabase/admin";
import { CopyLinkButton } from "@/app/trainer/volunteers/copy-link-button";
import { AddVolunteerForm } from "@/app/register/[token]/add-volunteer-form";

// A separate no-login link for center business/admissions staff -- distinct
// from the app's own `admin` UserRole. They have no account at all and
// aren't allowed on the course itself; this scopes them to just the
// volunteer register (view + add), nothing else. Resolved via the admin
// client after token validation, same pattern as /student/[token].
export default async function RegisterViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("course_id, expires_at")
    .eq("token", token)
    .eq("role", "register_viewer")
    .maybeSingle();

  if (!accessToken || new Date(accessToken.expires_at) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="sheet w-full max-w-sm text-center text-sm text-muted">
          This link has expired or isn&apos;t valid. Ask the trainer for a new one.
        </div>
      </div>
    );
  }

  const [{ data: course }, { data: volunteers }, { data: tpEvents }] = await Promise.all([
    admin.from("courses").select("name, start_date, end_date").eq("id", accessToken.course_id).maybeSingle(),
    admin.from("volunteer_students").select("id, name").eq("course_id", accessToken.course_id).is("removed_at", null).order("name"),
    admin.from("course_timetable_events").select("id").eq("course_id", accessToken.course_id).eq("type", "tp"),
  ]);

  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const [{ data: tokens }, { data: attendanceRows }] = await Promise.all([
    volunteerIds.length > 0
      ? admin.from("course_access_tokens").select("token, volunteer_student_id").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
    volunteerIds.length > 0
      ? admin.from("volunteer_attendance").select("volunteer_student_id").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const tokenByVolunteer = new Map((tokens ?? []).map((t) => [t.volunteer_student_id, t.token]));
  const attendanceCountByVolunteer = new Map<string, number>();
  for (const row of attendanceRows ?? []) {
    attendanceCountByVolunteer.set(row.volunteer_student_id, (attendanceCountByVolunteer.get(row.volunteer_student_id) ?? 0) + 1);
  }
  const totalTpSessions = tpEvents?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container flex flex-col gap-4 py-8">
        <div>
          <h1 className="font-serif text-2xl text-ink">Volunteer student register</h1>
          <p className="mt-1 text-sm text-muted">
            {[course?.name, course ? `${course.start_date} – ${course.end_date}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="sheet">
          <AddVolunteerForm token={token} />
        </div>

        <div className="sheet !p-0 overflow-hidden">
          {volunteers && volunteers.length > 0 ? (
            <ul>
              {volunteers.map((v) => {
                const vToken = tokenByVolunteer.get(v.id);
                return (
                  <li key={v.id} className="list-row flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-ink">{v.name}</p>
                      <p className="text-xs text-muted">
                        {attendanceCountByVolunteer.get(v.id) ?? 0} / {totalTpSessions} sessions attended
                      </p>
                    </div>
                    {vToken ? <CopyLinkButton token={vToken} /> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted">No volunteer students registered yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
