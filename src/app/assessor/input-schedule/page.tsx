import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus, isAssessorPreview } from "@/lib/auth/portfolio-access";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";

const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(51% 0.017 70)";
const AMBER = "oklch(44% 0.1 68)";

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// course-modes.md §7 (Handbook 3.4): "Moodle content ... must be augmented
// with centre-delivered online input. Assessors must be given a schedule
// showing which Moodle sections candidates were asked to complete and what
// input the centre provided."
//
// Built from the same is_asynchronous / linked_live_session_event_id pair the
// timetable already uses, not a separate document the centre would have to
// keep in step. Moved off the landing page by
// design_handoff_assessor_landing_v2, which keeps the rail to links.
export default async function AssessorInputSchedulePage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  if (!termsStatus.accepted && !(await isAssessorPreview())) redirect("/assessor/gate");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("name, delivery_mode").eq("id", courseId).maybeSingle();
  if (!course) redirect("/login?error=assessor_link_invalid");

  const { data: asyncEvents } =
    course.delivery_mode !== "f2f"
      ? await admin
          .from("course_timetable_events")
          .select("id, title, event_date, linked_live_session_event_id")
          .eq("course_id", courseId)
          .eq("type", "input_session")
          .eq("is_asynchronous", true)
          .order("event_date")
      : { data: [] as { id: string; title: string; event_date: string; linked_live_session_event_id: string | null }[] };

  const liveIds = (asyncEvents ?? []).map((e) => e.linked_live_session_event_id).filter((id): id is string => Boolean(id));
  const { data: liveEvents } =
    liveIds.length > 0
      ? await admin.from("course_timetable_events").select("id, title, event_date").in("id", liveIds)
      : { data: [] as { id: string; title: string; event_date: string }[] };
  const liveById = new Map((liveEvents ?? []).map((e) => [e.id, e]));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <AssessorReadOnlyBanner subject="the course" />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "34px 24px 60px" }}>
        <div className="frame" style={{ padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
            Assessor access — read-only · input schedule
          </p>
          <h1 style={{ fontFamily: "var(--font-newsreader), Georgia, serif", fontSize: 26, fontWeight: 600, marginTop: 6, color: INK }}>
            Self-study input, and what the centre added to it
          </h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 8, maxWidth: 660, lineHeight: 1.6 }}>
            Which sections candidates on {course.name} were asked to complete on their own, and the centre-delivered
            live input that augmented each one — Administration Handbook 3.4.
          </p>

          {course.delivery_mode === "f2f" ? (
            <p style={{ fontSize: 13, color: MUTED, marginTop: 22 }}>
              This is a face-to-face course. All input is delivered live, so there is no self-study schedule to show.
            </p>
          ) : (asyncEvents ?? []).length === 0 ? (
            <p style={{ fontSize: 13, color: MUTED, marginTop: 22 }}>
              No self-study input session has been timetabled on this course yet.
            </p>
          ) : (
            (asyncEvents ?? []).map((e) => {
              const live = e.linked_live_session_event_id ? liveById.get(e.linked_live_session_event_id) : null;
              return (
                <div key={e.id} className="card" style={{ marginTop: 14, padding: "14px 18px" }}>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{e.title}</p>
                  <p style={{ fontSize: 11.5, color: MUTED, marginTop: 2 }}>Set for {longDate(e.event_date)}</p>
                  <p style={{ fontSize: 12.5, color: live ? MUTED : AMBER, marginTop: 6, lineHeight: 1.55 }}>
                    {live
                      ? `Augmented by "${live.title}", delivered live on ${longDate(live.event_date)}.`
                      : "No live follow-up has been linked to this session yet."}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
