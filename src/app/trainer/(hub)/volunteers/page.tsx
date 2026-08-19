import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { removeVolunteerStudent, saveVolunteerTranscript } from "@/app/trainer/(hub)/volunteers/actions";
import { AddVolunteerForm } from "@/app/trainer/(hub)/volunteers/add-volunteer-form";
import { CopyLinkButton } from "@/app/trainer/(hub)/volunteers/copy-link-button";
import { SendStartingEmailButton } from "@/app/trainer/(hub)/volunteers/send-starting-email-button";
import { RegisterLinkButton } from "@/app/trainer/(hub)/volunteers/register-link-button";
import { AttendanceRegisterGrid } from "@/components/attendance-register-grid";
import { VolunteerSessionPanels } from "@/app/trainer/(hub)/volunteers/session-panels";
import { TP_LESSON_LENGTH_MINUTES } from "@/lib/tp-plan-content";
import { computeSessionTicks, CERTIFICATE_HOURS_THRESHOLD } from "@/lib/volunteer-attendance";
import { toLocalIso } from "@/lib/timetable-grid";

// §14 -- the trainer-side register that mints the tokenized links volunteer
// students use to reach /student/[token] (no login, no password -- see
// migration 0030 and the auth-model note in project memory). Checkpoint 9
// adds a second, read-only viewer: an assessor session (getAssessorCourseId,
// same pattern as roster/celta5/grades-report) sees the real per-session
// attendance register -- build-spec.md's own named gap for the assessor
// pack -- but none of the management controls (add/remove/copy-link),
// which stay trainer/admin-only.
export default async function VolunteersPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  const supabase = assessorCourseId ? createAdminClient() : await createClient();
  const { data: volunteers } = await supabase
    .from("volunteer_students")
    .select("*")
    .eq("course_id", courseId)
    .is("removed_at", null)
    .order("name");

  const { data: courseForThreshold } = await supabase.from("courses").select("center_id").eq("id", courseId).maybeSingle();
  const { data: centerForThreshold } = courseForThreshold
    ? await supabase.from("centers").select("volunteer_certificate_hours_threshold").eq("id", courseForThreshold.center_id).maybeSingle()
    : { data: null };
  const certificateHoursThreshold = centerForThreshold?.volunteer_certificate_hours_threshold ?? CERTIFICATE_HOURS_THRESHOLD;

  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const [{ data: tokens }, { data: tpEvents }, { data: attendanceRows }, { data: signupProfiles }] = await Promise.all([
    volunteerIds.length > 0
      ? supabase.from("course_access_tokens").select("token, volunteer_student_id").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
    supabase.from("course_timetable_events").select("id, event_date").eq("course_id", courseId).eq("type", "tp").order("event_date"),
    volunteerIds.length > 0
      ? supabase.from("volunteer_attendance").select("volunteer_student_id, timetable_event_id").in("volunteer_student_id", volunteerIds)
      : Promise.resolve({ data: [] }),
    !trainer && volunteerIds.length > 0
      ? Promise.resolve({ data: [] })
      : volunteerIds.length > 0
        ? supabase.from("volunteer_signup_profiles").select("volunteer_student_id, transcript").in("volunteer_student_id", volunteerIds)
        : Promise.resolve({ data: [] }),
  ]);
  const tokenByVolunteer = new Map((tokens ?? []).map((t) => [t.volunteer_student_id, t.token]));
  const transcriptByVolunteer = new Map((signupProfiles ?? []).map((p) => [p.volunteer_student_id, p.transcript]));

  const today = toLocalIso(new Date());
  const volunteerSessions = (volunteers ?? []).map((v) => {
    const attendedEventIds = new Set(
      (attendanceRows ?? []).filter((a) => a.volunteer_student_id === v.id).map((a) => a.timetable_event_id)
    );
    const sessions = computeSessionTicks(tpEvents ?? [], attendedEventIds, TP_LESSON_LENGTH_MINUTES);
    return {
      id: v.id,
      name: v.name,
      today: sessions.find((s) => s.date === today) ?? null,
      certificateHours: sessions.reduce((sum, s) => sum + s.creditedMinutes, 0) / 60,
    };
  });

  if (!trainer) {
    // Assessor: read-only register, no management controls at all.
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">Attendance register</h1>
          <p className="mt-1 text-sm text-muted">Volunteer student attendance at teaching practice sessions.</p>
        </div>
        <AttendanceRegisterGrid events={tpEvents ?? []} volunteers={volunteers ?? []} attendance={attendanceRows ?? []} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
            {volunteers?.length ?? 0} registered, {volunteerSessions.filter((v) => (v.today?.attendedBlocks ?? 0) > 0).length} in
            today
          </p>
          <h1 className="font-serif text-2xl text-ink">Volunteer students</h1>
          <p className="mt-1 text-sm text-muted">
            The TP students who attend teaching practice. Each gets their own no-login link to see shared materials
            and their attendance -- links expire when the course ends.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href="/api/filming-consent.pdf"
            className="rounded-[6px] border border-border px-3 py-1.5 text-xs font-medium text-ink hover:border-primary"
          >
            Filming consent form ↓
          </a>
          <RegisterLinkButton />
        </div>
      </div>

      <VolunteerSessionPanels sessions={volunteerSessions} certificateHoursThreshold={certificateHoursThreshold} />

      <AddVolunteerForm />

      <div className="sheet !p-0 overflow-hidden">
        {volunteers && volunteers.length > 0 ? (
          <ul>
            {volunteers.map((volunteer) => {
              const token = tokenByVolunteer.get(volunteer.id);
              const transcript = transcriptByVolunteer.get(volunteer.id);
              return (
                <li key={volunteer.id} className="list-row flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-ink">
                      {volunteer.name}
                      {volunteer.level ? <span className="ml-2 text-xs text-muted">{volunteer.level}</span> : null}
                      {!volunteer.signup_completed_at ? <span className="ml-2 text-xs text-muted">-- sign-up not completed</span> : null}
                    </p>
                    <div className="flex items-center gap-3">
                      {token ? <CopyLinkButton token={token} /> : null}
                      {token && volunteer.email ? <SendStartingEmailButton volunteerId={volunteer.id} /> : null}
                      <form action={removeVolunteerStudent}>
                        <input type="hidden" name="volunteer_id" value={volunteer.id} />
                        <button type="submit" className="text-xs text-destructive hover:underline">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                  {volunteer.signup_completed_at ? (
                    transcript ? (
                      <p className="text-xs text-muted">Transcript on file (for Focus on the Learner).</p>
                    ) : (
                      <form action={saveVolunteerTranscript} className="flex items-end gap-2">
                        <input type="hidden" name="volunteer_id" value={volunteer.id} />
                        <textarea
                          name="transcript"
                          required
                          rows={1}
                          placeholder="No transcript yet -- listen to the recording and paste one here"
                          className="w-full flex-1 rounded-[6px] border border-border bg-card px-2 py-1 text-xs text-ink outline-none focus:border-primary"
                        />
                        <button type="submit" className="shrink-0 rounded-[6px] border border-border px-2 py-1 text-xs text-ink hover:border-primary">
                          Save
                        </button>
                      </form>
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-6 text-sm text-muted">No volunteer students added yet.</p>
        )}
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Attendance register</h2>
        <p className="mt-1 text-sm text-muted">Real per-session attendance -- this is what goes to the assessor.</p>
        <div className="mt-3">
          <AttendanceRegisterGrid events={tpEvents ?? []} volunteers={volunteers ?? []} attendance={attendanceRows ?? []} />
        </div>
      </div>
    </div>
  );
}
