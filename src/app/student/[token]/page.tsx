import { createAdminClient } from "@/lib/supabase/admin";
import { MaterialsCard } from "@/app/student/[token]/materials-card";
import { VolunteerSignupForm } from "@/app/student/[token]/signup-form";
import { DeclineButton } from "@/app/student/[token]/decline-button";
import { SIGNUP_QUESTIONS } from "@/lib/fol/volunteer-signup-questions";
import { Wordmark } from "@/components/wordmark";
import { DesignerCredit } from "@/components/designer-credit";
import { getVolunteerIdentityData, TICK_THRESHOLD_MINUTES, CERTIFICATE_HOURS_THRESHOLD } from "@/lib/volunteer-cross-course";
import { PushSubscribeButton } from "@/components/push-subscribe-button";
import { subscribeVolunteerPush, unsubscribeVolunteerPush } from "@/lib/push/actions";

// Four evenly-spaced markers scaled to whatever the centre has set --
// quarters of the threshold, rounded to the nearest 10 hours, rather than
// the old fixed 40/80/120/160 which only made sense at the default value.
function milestonesFor(threshold: number): number[] {
  const step = Math.max(Math.round(threshold / 4 / 10) * 10, 1);
  const marks = [step, step * 2, step * 3, threshold];
  return [...new Set(marks)].sort((a, b) => a - b);
}

function formatEventDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000);
  const dayLabel = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if (diffDays === 0) return `Today, ${dayLabel}`;
  if (diffDays === 1) return `Tomorrow, ${dayLabel}`;
  return dayLabel;
}

// Volunteer View.dc.html, written 14 Aug 2026: no login, no password --
// resolved entirely from a tokenized, course-scoped, auto-expiring link
// (migration 0030), every read going through the admin client with
// explicit scoping (there is no auth.uid() session on this path at all).
// One responsive layout rather than the source design's separate 1a/1b
// mockups -- identical content and data either way, per the design's own
// framing ("same data reflows into a table + sidebar on desktop").
export default async function StudentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("*")
    .eq("token", token)
    .eq("role", "volunteer_student")
    .maybeSingle();

  if (!accessToken || !accessToken.volunteer_student_id || new Date(accessToken.expires_at) < new Date()) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="sheet-accent w-full max-w-sm p-8 text-center">
          <Wordmark size="hero" />
          <p className="mt-4 text-sm text-destructive">
            This link has expired or isn&apos;t valid. Ask your teacher for a new one.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: volunteer }, { data: course }, { data: sharedMaterials }] = await Promise.all([
    admin.from("volunteer_students").select("name, signup_completed_at").eq("id", accessToken.volunteer_student_id).maybeSingle(),
    admin.from("courses").select("name, end_date, center_id").eq("id", accessToken.course_id).maybeSingle(),
    admin
      .from("volunteer_shared_materials")
      .select("id, created_at, tp_materials(id, file_name, slides_url, storage_path, tp_plans(main_aims))")
      .eq("course_id", accessToken.course_id)
      .order("created_at", { ascending: false }),
  ]);

  if (!volunteer) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="sheet-accent w-full max-w-sm p-8 text-center">
          <Wordmark size="hero" />
          <p className="mt-4 text-sm text-destructive">This link isn&apos;t valid. Ask your teacher for a new one.</p>
        </div>
      </div>
    );
  }

  // One-time collection, before the ongoing dashboard ever shows -- feeds
  // FOL's pooled-evidence model (class_error_log/fol_claims), unlocked to
  // candidates only from the course's Day-10 divergence session on.
  if (!volunteer.signup_completed_at) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-10">
          <div>
            <p className="text-sm font-medium text-muted uppercase tracking-wide">{course?.name ?? "Your course"}</p>
            <h1 className="mt-1 font-serif text-3xl text-ink">Welcome, {volunteer.name}!</h1>
            <p className="mt-2 text-sm text-muted">
              Before your first class, tell us a bit about yourself -- this helps your teachers get to know you.
            </p>
          </div>
          <div className="card p-6">
            <VolunteerSignupForm token={token} questions={SIGNUP_QUESTIONS} />
          </div>
        </div>
      </div>
    );
  }

  const [{ hoursCredited, classes }, { data: centerForThreshold }] = await Promise.all([
    getVolunteerIdentityData(admin, accessToken.volunteer_student_id),
    course?.center_id
      ? admin.from("centers").select("volunteer_certificate_hours_threshold").eq("id", course.center_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const certificateHoursThreshold = centerForThreshold?.volunteer_certificate_hours_threshold ?? CERTIFICATE_HOURS_THRESHOLD;

  // Scoped to this token's own course only (not the cross-course list
  // below) -- the decline action re-resolves volunteer_student_id from the
  // token itself, so the class shown here must belong to that same row.
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = classes
    .filter((c) => c.courseId === accessToken.course_id && c.eventDate >= today)
    .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1));
  const nextClass = upcoming[0] ?? null;

  const { data: nextClassDecline } = nextClass
    ? await admin
        .from("volunteer_declines")
        .select("id")
        .eq("volunteer_student_id", accessToken.volunteer_student_id)
        .eq("timetable_event_id", nextClass.eventId)
        .maybeSingle()
    : { data: null };

  // "Teachers"/"topic" for the next class -- linked_tp_number is matched by
  // VALUE against plan_assignments.tp_number (not a foreign key), and one
  // calendar TP day can host several trainees' rotation slots, so this
  // shows everyone teaching that round rather than a single "the" lesson.
  let nextClassEvent: { linked_tp_number: number | null } | null = null;
  let nextClassTeachers: { name: string; topic: string | null }[] = [];
  if (nextClass) {
    const { data: eventRow } = await admin
      .from("course_timetable_events")
      .select("linked_tp_number")
      .eq("id", nextClass.eventId)
      .maybeSingle();
    nextClassEvent = eventRow ?? null;
    if (nextClassEvent?.linked_tp_number != null) {
      const { data: assignments } = await admin
        .from("plan_assignments")
        .select("trainee_id, short_title, main_lesson_aim")
        .eq("course_id", nextClass.courseId)
        .eq("tp_number", nextClassEvent.linked_tp_number);
      const traineeIds = [...new Set((assignments ?? []).map((a) => a.trainee_id))];
      const { data: trainerProfiles } = traineeIds.length
        ? await admin.from("profiles").select("id, full_name").in("id", traineeIds)
        : { data: [] };
      const nameById = new Map((trainerProfiles ?? []).map((p) => [p.id, p.full_name]));
      nextClassTeachers = (assignments ?? []).map((a) => ({
        name: nameById.get(a.trainee_id) ?? "Your teacher",
        topic: a.short_title || a.main_lesson_aim || null,
      }));
    }
  }

  // "This course" -- deliberately narrower than the cross-course hours
  // above: N of M classes attended, this course only, no percentage.
  const thisCourseClasses = classes.filter((c) => c.courseId === accessToken.course_id);
  const thisCourseAttended = thisCourseClasses.filter((c) => c.attended === true).length;

  // Resolved server-side with the admin client -- a volunteer has no
  // Supabase session at all, so a browser client could never sign a
  // storage URL themselves the way MaterialsSection does for trainees.
  const resolvedMaterials = await Promise.all(
    (sharedMaterials ?? []).map(async (row) => {
      const material = row.tp_materials as unknown as {
        id: string;
        file_name: string | null;
        slides_url: string | null;
        storage_path: string | null;
        tp_plans: { main_aims: string | null } | null;
      } | null;
      if (!material) return null;

      let url = material.slides_url;
      if (!url && material.storage_path) {
        const { data: signed } = await admin.storage.from("tp-materials").createSignedUrl(material.storage_path, 3600);
        url = signed?.signedUrl ?? null;
      }
      if (!url) return null;

      return {
        id: material.id,
        name: material.file_name ?? "Material",
        url,
        topic: material.tp_plans?.main_aims ?? null,
      };
    })
  );
  const materials = resolvedMaterials.filter((m): m is NonNullable<typeof m> => m !== null);

  const hoursRemaining = Math.max(certificateHoursThreshold - hoursCredited, 0);
  const progressPct = Math.min((hoursCredited / certificateHoursThreshold) * 100, 100);
  const milestones = milestonesFor(certificateHoursThreshold);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-10">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <Wordmark size="header" />
          <p className="text-sm font-medium text-ink">{volunteer.name} · volunteer student</p>
        </div>

        <div>
          <p className="text-sm font-medium text-muted uppercase tracking-wide">{course?.name ?? "Your course"}</p>
          <h1 className="mt-1 font-serif text-2xl text-ink sm:text-3xl">
            {nextClass ? `Your next class is ${formatEventDate(nextClass.eventDate).split(",")[0].toLowerCase()}` : "No classes scheduled yet"}
          </h1>
        </div>

        {/* Next class card */}
        {nextClass ? (
          <div className="card flex flex-col gap-3 p-6">
            <p className="text-sm font-semibold text-ink">{formatEventDate(nextClass.eventDate)}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {nextClass.eventTime ? <span>{nextClass.eventTime.slice(0, 5)}</span> : null}
              <span>{nextClass.zoomUrl ? "Online" : "In person at the centre"}</span>
              {nextClassTeachers.length > 0 ? <span>with {nextClassTeachers.map((t) => t.name).join(", ")}</span> : null}
            </div>
            {nextClassTeachers.some((t) => t.topic) ? (
              <p className="text-sm text-ink">{nextClassTeachers.find((t) => t.topic)?.topic}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {nextClass.zoomUrl ? (
                <a href={nextClass.zoomUrl} target="_blank" rel="noopener noreferrer" className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                  Join online
                </a>
              ) : null}
              <a
                href={`data:text/calendar;charset=utf-8,${encodeURIComponent(
                  `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${course?.name ?? "Class"}\nDTSTART:${nextClass.eventDate.replace(/-/g, "")}\nEND:VEVENT\nEND:VCALENDAR`
                )}`}
                download="class.ics"
                className="rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-ink hover:border-primary"
              >
                Add to calendar
              </a>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-border-faint pt-3">
              <DeclineButton token={token} eventId={nextClass.eventId} alreadyDeclined={Boolean(nextClassDecline)} />
              <PushSubscribeButton
                subscribe={(input) => subscribeVolunteerPush(token, input)}
                unsubscribe={(endpoint) => unsubscribeVolunteerPush(token, endpoint)}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.3fr_1fr]">
          <div className="flex flex-col gap-6">
            {/* Your classes */}
            <div className="card p-6">
              <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Your classes</p>
              {classes.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No classes scheduled yet.</p>
              ) : (
                <div className="mt-2 flex flex-col">
                  {classes.slice(0, 12).map((c, i) => (
                    <div key={c.eventId} className={`flex items-center justify-between gap-3 py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                      <div>
                        <p className="text-sm text-ink">{formatEventDate(c.eventDate)}</p>
                        <p className="text-xs text-muted">{c.courseName}</p>
                      </div>
                      <span
                        className={`pill ${c.attended === null ? "pill-info" : c.attended ? "pill-success" : "pill-warning"}`}
                      >
                        {c.attended === null ? "Upcoming" : c.attended ? "Attended" : "Missed"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <MaterialsCard materials={materials} />
          </div>

          <div className="flex flex-col gap-6">
            {/* Your hours */}
            <div className="card p-6">
              <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Your hours</p>
              <p className="mt-1 font-serif text-3xl text-ink">{hoursCredited.toFixed(1)}h</p>
              <p className="mt-1 text-sm text-muted">
                {hoursRemaining > 0 ? `You are ${hoursRemaining.toFixed(1)} hours from your certificate.` : "You've reached the certificate threshold."} Every
                class adds {(TICK_THRESHOLD_MINUTES / 60 + 0.75).toFixed(2).replace(/\.?0+$/, "")}
                {" "}
                hours.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-muted">
                {milestones.map((m) => (
                  <span key={m} className={hoursCredited >= m ? "font-semibold text-ink" : ""}>
                    {m}h
                  </span>
                ))}
              </div>
            </div>

            {/* This course */}
            <div className="card p-6">
              <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">This course</p>
              <p className="mt-1 text-sm text-ink">
                {thisCourseAttended} of {thisCourseClasses.length} classes attended
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {thisCourseClasses
                  .slice()
                  .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1))
                  .map((c) => (
                    <span
                      key={c.eventId}
                      className={`size-2.5 rounded-full ${c.attended === true ? "bg-primary" : c.attended === false ? "bg-border" : "bg-surface-muted"}`}
                      title={c.eventDate}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 border-t border-border-faint pt-4 text-center text-xs text-muted">
          <p>This link is yours alone, and works until the course ends{course?.end_date ? ` on ${new Date(`${course.end_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}` : ""}.</p>
          {materials.length > 0 ? (
            <p>
              <a href="#materials" className="font-semibold text-primary hover:underline">
                Download all my materials before then →
              </a>
            </p>
          ) : null}
        </div>
      </div>

      <DesignerCredit />
    </div>
  );
}
