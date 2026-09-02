import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { updateAssessorVisitDate, updateEntryFormSentAt, updateAssessor } from "@/app/dashboard/admin/courses/[id]/roster-actions";
import { ApplicationSettingsForm } from "@/app/dashboard/admin/courses/[id]/application-settings-form";
import { TutorRoleControl } from "@/app/dashboard/admin/courses/[id]/tutor-role-control";
import { TutorInviteForm } from "@/app/dashboard/admin/courses/[id]/tutor-invite-form";
import { EntryFormSentCheckbox } from "@/app/dashboard/admin/courses/[id]/entry-form-sent-checkbox";
import { computeWeekOf, computeCourseState } from "@/lib/course-progress";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { computeEntryFormDeadline } from "@/lib/entry-form-deadline";
import { computeApplicantCounts, summarizeApplicantsForCard, MIN_CANDIDATES } from "@/lib/admissions-counts";

// for-claude-code-course-admin-landing-and-admissions.md §2 +
// for-claude-code-course-admin-page-not-rebuilt.md: the old kitchen-sink
// page (roster editing, TP subgroups, restarts/deferrals, close-out,
// certificate-check, chat retention, material pool, delivery mode) is
// gone from here -- all of that is MCT-owned, inside the course, once
// it's running (see the footnote below). This page is exactly 4 panels:
// Admissions pipeline, Entry form, Tutors, Assessor -- the things that
// are genuinely Course Admin's job for as long as the course is still
// filling up. The applications-open toggle stays on the Admissions
// pipeline card (restored 2026-08-23): the new landing list's
// "Interviewing now" vs "Launching soon" grouping reads directly off
// accepting_applications, so it needs a real control somewhere, and this
// is the same admissions cycle it already describes.

export default async function CourseAdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireRole("admin");
  const supabase = await createClient();

  const { data: course } = await supabase.from("courses").select("*").eq("id", id).maybeSingle();
  if (!course || course.center_id !== admin.center_id) notFound();

  const [{ data: center }, { data: tutorRows }, { data: applicants }] = await Promise.all([
    // single-centre: the Appian URL of the centre this course belongs to
    supabase.from("centers").select("appian_url").eq("id", admin.center_id).maybeSingle(),
    supabase.from("course_tutors").select("id, profile_id, tutor_role, verified_at").eq("course_id", id).is("left_at", null),
    supabase.from("applicants").select("id, full_name, stage, special_requirements").eq("intake_course_id", id),
  ]);

  const tutorProfileIds = (tutorRows ?? []).map((t) => t.profile_id);
  const { data: tutorProfiles } = tutorProfileIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", tutorProfileIds)
    : { data: [] };
  const profileById = new Map((tutorProfiles ?? []).map((p) => [p.id, p]));
  const tutors = (tutorRows ?? []).map((t) => ({
    courseTutorId: t.id,
    profileId: t.profile_id,
    name: profileById.get(t.profile_id)?.full_name ?? "Unknown",
    email: profileById.get(t.profile_id)?.email ?? "",
    role: t.tutor_role,
    joined: Boolean(t.verified_at),
  }));

  const { accepted: acceptedCount } = computeApplicantCounts(applicants ?? []);
  const candidateRows = summarizeApplicantsForCard(applicants ?? []);
  const CANDIDATE_ROW_LIMIT = 5;
  const visibleCandidateRows = candidateRows.slice(0, CANDIDATE_ROW_LIMIT);
  const hiddenCandidateCount = candidateRows.length - visibleCandidateRows.length;

  const timeZone = (await getCachedCenter(admin.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);
  const courseState = computeCourseState(course.start_date, course.end_date, today);
  const weekOf = courseState === "running" ? computeWeekOf(course.start_date, course.end_date, today) : null;

  // §5a (Handbook §7): soft warning only, never a gate -- centres get
  // case-by-case Cambridge approval for smaller courses by email.
  const belowMinimum = courseState !== "closed" && acceptedCount > 0 && acceptedCount < MIN_CANDIDATES;

  const entryFormDeadline = computeEntryFormDeadline(course.start_date, course.delivery_mode);
  const entryFormOverdue = !course.entry_form_sent_at && entryFormDeadline < today;

  return (
    <div className="flex flex-col gap-6">
      <div className="card card-garnet flex items-start justify-between gap-4 p-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
            {course.start_date} &ndash; {course.end_date}
            {weekOf ? ` · ${weekOf}` : ""}
          </p>
          <h1 className="mt-0.5 font-serif text-xl text-ink">{course.name}</h1>
        </div>
        {/* Duplicate is deliberately NOT here.
        
            Centre Management's course list states the rule -- "duplicate-
            course lives on this overview (the course list), not inside an
            individual course's detail" -- and then this page did it anyway,
            so the same action appeared in three places with no pattern to
            it. Ramy, 31 Aug 2026: "you can now duplicate the course from
            inside the course... it's all connected in it. It's confusing."
        
            One rule now: you duplicate a course from wherever courses are
            listed. Both lists have it (Centre Management's Overview and
            Course Admin's landing), and neither of the places you go to
            work ON one course does. Duplicating is a decision about the
            set of courses, not about the course you are standing in. */}
      </div>

      {/* Admissions pipeline */}
      <div className={`card flex flex-col gap-4 p-6 ${belowMinimum ? "card-amber" : ""}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg text-ink">Admissions pipeline</h2>
            <p className="mt-1 text-sm text-muted">
              Ongoing for as long as this course is still accepting applications -- interview notifications,
              acceptances, and invites all happen from here.
            </p>
          </div>
          <Link href={`/dashboard/admissions/pipeline?course=${course.id}`} className="shrink-0 text-sm font-medium text-primary hover:underline">
            Full applications view &rarr;
          </Link>
        </div>

        {/* Course Administrator Landing.dc.html, Screen 2: individual
            candidates, not just the landing list's aggregate counts --
            flagged first, since that's the one needing a look before any
            decision (§5b). Read-only here; actual decisions (accept,
            interview, offer) stay on each candidate's own admissions page,
            not duplicated inline -- that's where the real workflow already
            lives, not something to rebuild a second time here. */}
        {candidateRows.length > 0 ? (
          <div className="flex flex-col border-t border-border-faint">
            {visibleCandidateRows.map((row) => (
              <Link
                key={row.id}
                href={`/dashboard/admissions/${row.id}`}
                className="admin-hover grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border-faint py-2.5 transition-colors duration-150 admin-hover-fill"
              >
                <span className="truncate text-sm font-medium text-ink">{row.fullName}</span>
                <span className="text-xs text-muted">{row.stageLabel}</span>
                {row.flagged ? (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">Flagged</span>
                ) : row.accepted ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Accepted</span>
                ) : (
                  <span className="text-xs text-muted">{row.statusLabel}</span>
                )}
              </Link>
            ))}
            {hiddenCandidateCount > 0 ? (
              <p className="pt-2 text-xs text-muted">
                +{hiddenCandidateCount} more --{" "}
                <Link href={`/dashboard/admissions/pipeline?course=${course.id}`} className="text-primary hover:underline">
                  full applications view
                </Link>
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted">No applicants yet.</p>
        )}
        {belowMinimum ? (
          <p className="text-sm text-status-warning-text">
            {acceptedCount} accepted -- below the minimum of {MIN_CANDIDATES} (Handbook §7). Contact Cambridge (JCA) if
            this doesn&apos;t change before the start date.
          </p>
        ) : null}
        <ApplicationSettingsForm
          courseId={course.id}
          accepting={course.accepting_applications}
          applicationCap={course.application_cap}
        />
      </div>

      {/* Entry form -- link out to Appian, not a submit action. There is no
          Appian integration and none is planned; "sent" is a manual
          attestation, never a status pulled from Appian. */}
      {/* Real semantic red when overdue; otherwise the decorative garnet
          alternation (matches the header card above it) rather than plain
          teal, since Tutors right below stays teal. */}
      <div className={`card flex flex-col gap-4 p-6 ${entryFormOverdue ? "card-red" : "card-garnet"}`}>
        <div>
          <h2 className="font-serif text-lg text-ink">Entry form</h2>
          <p className="mt-1 text-sm text-muted">
            Fixes the cohort and the candidates&apos; names as Cambridge holds them, and decides whether a later
            withdrawal is internal only or reportable. Submitted in Appian directly -- Connect only tracks whether
            it&apos;s been done.
          </p>
        </div>
        {!course.entry_form_sent_at ? (
          <p className={`text-sm ${entryFormOverdue ? "font-semibold text-destructive" : "text-muted"}`}>
            {entryFormOverdue ? "Overdue" : "Due"} {entryFormDeadline} -- {course.delivery_mode === "online" ? "four" : "two"} weeks before
            the course starts (Handbook 4.1).
          </p>
        ) : (
          <p className="text-sm text-ink">Marked sent {course.entry_form_sent_at.slice(0, 10)}.</p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          {center?.appian_url ? (
            <a
              href={center.appian_url}
              target="_blank"
              rel="noreferrer"
              className="admin-hover-fill rounded-[6px] border border-border px-3.5 py-2 text-sm font-medium text-ink hover:border-primary"
            >
              Open Appian &rarr;
            </a>
          ) : (
            <p className="text-xs text-muted">
              No Appian sign-in link set yet --{" "}
              <Link href="/centre/settings" className="text-primary hover:underline">
                add one in Centre Settings
              </Link>
              .
            </p>
          )}
          <EntryFormSentCheckbox
            action={updateEntryFormSentAt}
            courseId={course.id}
            fieldName="entry_form_sent_at"
            sent={Boolean(course.entry_form_sent_at)}
          />
        </div>
      </div>

      {/* Tutors -- view current MCT/ACT, replace if needed. No edit access
          to their in-course work (roster/subgroups/grades etc. are MCT
          territory, see the footnote). */}
      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">Tutors</h2>
        {tutors.length === 0 ? (
          <p className="text-sm text-muted">No tutors have joined yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tutors.map((t) => (
              <div key={t.profileId} className="flex items-center justify-between gap-3 border-t border-border-faint pt-2 first:border-none first:pt-0">
                <div>
                  <p className="text-sm text-ink">
                    {t.name} {!t.joined ? <span className="text-xs text-muted">(invited)</span> : null}
                  </p>
                  <p className="text-xs text-muted">{t.email}</p>
                </div>
                <TutorRoleControl
                  courseTutorId={t.courseTutorId}
                  courseId={course.id}
                  current={t.role}
                  courseRunning={courseState === "running"}
                  tutorName={t.name}
                />
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-border-faint pt-4">
          <TutorInviteForm courseId={course.id} />
        </div>
      </div>

      {/* Assessor -- one shared field, not duplicated per side. Whichever
          side (Course Admin here, or the MCT once the course is running)
          sets it first is what the other sees. */}
      <div className="card card-garnet flex flex-col gap-4 p-6">
        <div>
          <h2 className="font-serif text-lg text-ink">Assessor</h2>
          <p className="mt-1 text-sm text-muted">
            Optional -- often not known this early. Name it now if you already know, or leave it for the MCT to set
            once the course is running. The MCT gets notified with this contact info as soon as it&apos;s set.
          </p>
        </div>
        <form action={updateAssessor} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <input type="hidden" name="course_id" value={course.id} />
          <div className="flex flex-col gap-1">
            <label htmlFor="assessor_name" className="text-xs text-muted">
              Name
            </label>
            <input
              id="assessor_name"
              name="assessor_name"
              type="text"
              defaultValue={course.assessor_name ?? ""}
              className="h-10 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="assessor_email" className="text-xs text-muted">
              Email
            </label>
            <input
              id="assessor_email"
              name="assessor_email"
              type="email"
              defaultValue={course.assessor_email ?? ""}
              className="h-10 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <button type="submit" className="admin-hover-fill h-10 rounded-[6px] border border-border px-3 text-sm text-ink hover:border-primary">
            Save
          </button>
        </form>
        {/* Visit date itself is confirmed by the MCT once the course is
            running (forms 3/4, tied to the grading pipeline) -- kept here
            too since it already existed and Announcements' assessor-visit
            reminder reads it regardless of who set it. */}
        <form action={updateAssessorVisitDate} className="flex items-center gap-2 border-t border-border-faint pt-3">
          <input type="hidden" name="course_id" value={course.id} />
          <label htmlFor="assessor_visit_date" className="text-xs text-muted">
            Visit date (if known)
          </label>
          <input
            id="assessor_visit_date"
            type="date"
            name="assessor_visit_date"
            defaultValue={course.assessor_visit_date ?? ""}
            className="h-9 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
          />
          <button type="submit" className="admin-hover-fill rounded-[6px] border border-border px-3 py-1.5 text-xs text-ink hover:border-primary">
            Save
          </button>
        </form>
      </div>

      <p className="text-xs text-muted">
        Not on this page: timetable, TP groups, assignments, grades, chat retention, feedback tone, close-out, and
        the Drive/resource library. All of that is MCT-owned once the course is running, inside the course itself.
      </p>
    </div>
  );
}
