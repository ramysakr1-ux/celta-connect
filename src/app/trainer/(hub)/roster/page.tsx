import { hubReadClient } from "@/lib/supabase/hub-read";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { fetchRosterRows } from "@/lib/roster";
import { RosterTable } from "@/app/trainer/(hub)/roster/roster-table";
import { AlsoUnder } from "@/app/trainer/(hub)/also-under";
import { isMctOfCourse } from "@/lib/course-tutor-role";
import { PageHead, HUB_BUTTON } from "@/app/trainer/(hub)/page-head";
import { AddCandidateButton } from "@/app/trainer/(hub)/roster/add-candidate-button";
import { FilmingConsentCard } from "@/app/trainer/(hub)/roster/filming-consent-card";
import { ManageTutorsCard } from "@/app/trainer/(hub)/roster/manage-tutors-card";
import { DeliveryModeCard } from "@/app/trainer/(hub)/roster/delivery-mode-card";
import { ChatRetentionCard } from "@/app/trainer/(hub)/roster/chat-retention-card";
import type { AssignableTrainer } from "@/app/dashboard/admin/courses/[id]/assign-tutor-panel";
import type { DeliveryMode } from "@/lib/delivery-mode";
import { isCourseStatusReadOnly } from "@/lib/course-status";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// The detailed operational roster. Row computation lives in lib/roster.ts,
// shared with the CSV export route below so the two can't drift on what a
// column means. Layout: design_handoff_trainer_roster (5 Sep 2026) -- the
// candidates first, seven glance columns plus a progress strip behind a
// switch, then the course's own settings for the MCT.
export default async function TrainerRosterPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }
  const supabase = trainer ? hubReadClient(trainer, courseId) : createAdminClient();

  // Wave 1: the roster and everything that needs only the course or the
  // trainer, together. Perf audit 5 Sep 2026: this page ran ~35 queries in
  // 21 one-after-another steps. isMct now comes from the cache()'d
  // course_tutors helper the layout already paid for -- the old
  // profiles.tutor_role guess is the stale column layout.tsx warns about.
  const adminClient = createAdminClient();
  const [rows, isMct, filmsTpSessions, { data: courseRow }, { data: tutorRows }, { data: invitationRows }, { data: centreTrainers }] =
    await Promise.all([
      fetchRosterRows(supabase, courseId),
      trainer ? isMctOfCourse(trainer, courseId) : Promise.resolve(false),
      // specs/admissions-and-close-out.md §10 -- "only used if a centre films."
      trainer?.center_id ? supabase.from("centers").select("films_tp_sessions").eq("id", trainer.center_id).maybeSingle().then((r) => Boolean(r.data?.films_tp_sessions)) : Promise.resolve(false),
      trainer
        ? adminClient.from("courses").select("trainee_join_token, course_code, name, start_date, chat_retention_days, chat_retention_mode, delivery_mode").eq("id", courseId).maybeSingle()
        : Promise.resolve({ data: null }),
      trainer
        ? adminClient.from("course_tutors").select("id, profile_id, tutor_role, verified_at, owned_assignment_types").eq("course_id", courseId).is("left_at", null)
        : Promise.resolve({ data: [] as { id: string; profile_id: string; tutor_role: string | null; verified_at: string | null; owned_assignment_types: string[] }[] }),
      trainer
        ? adminClient.from("course_invitations").select("id, email, full_name, tutor_role").eq("course_id", courseId).eq("role", "trainer").is("revoked_at", null).is("accepted_at", null)
        : Promise.resolve({ data: [] as { id: string; email: string; full_name: string | null; tutor_role: string | null }[] }),
      trainer
        ? adminClient.from("profiles").select("id, full_name, email, course_id").eq("role", "trainer").eq("center_id", trainer.center_id)
        : Promise.resolve({ data: [] as { id: string; full_name: string; email: string; course_id: string | null }[] }),
    ]);

  // Wave 2: the ones that need wave 1's ids.
  const tutorProfileIds = (tutorRows ?? []).map((t) => t.profile_id);
  const otherTrainers = (centreTrainers ?? []).filter((p) => !tutorProfileIds.includes(p.id));
  const homeCourseIds = [...new Set(otherTrainers.map((p) => p.course_id).filter((id): id is string => Boolean(id)))];
  const frozenIds = rows.filter((r) => isCourseStatusReadOnly(r.courseStatus)).map((r) => r.id);
  const [{ data: consentRows }, { data: tutorProfiles }, { data: homeCourses }, { data: frozenRows }, center] = await Promise.all([
    filmsTpSessions && rows.length > 0
      ? supabase.from("profiles").select("id, filming_consent_confirmed_at").in("id", rows.map((r) => r.id))
      : Promise.resolve({ data: [] as { id: string; filming_consent_confirmed_at: string | null }[] }),
    tutorProfileIds.length
      ? adminClient.from("profiles").select("id, full_name, email, course_id").in("id", tutorProfileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string; course_id: string | null }[] }),
    homeCourseIds.length
      ? adminClient.from("courses").select("id, name").in("id", homeCourseIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    // When a frozen candidate left, for their "Left week N · record kept"
    // sub-line -- only fetched when there is one.
    frozenIds.length
      ? supabase.from("profiles").select("id, course_status_set_at").in("id", frozenIds)
      : Promise.resolve({ data: [] as { id: string; course_status_set_at: string | null }[] }),
    trainer?.center_id ? getCachedCenter(trainer.center_id) : Promise.resolve(null),
  ]);
  const consentConfirmedById = new Map((consentRows ?? []).map((r) => [r.id, !!r.filming_consent_confirmed_at]));

  // "Left week N · record kept" -- the week of the course the status was
  // set in, counted from the course start in the centre's own time zone.
  const frozenSubById: Record<string, string> = {};
  const startDate = courseRow?.start_date ?? null;
  const timeZone = center?.time_zone ?? DEFAULT_TIMEZONE;
  for (const r of frozenRows ?? []) {
    if (!startDate || !r.course_status_set_at) continue;
    const left = toLocalIso(new Date(r.course_status_set_at), timeZone);
    const days = (Date.parse(`${left}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000;
    const week = Math.max(1, Math.floor(days / 7) + 1);
    frozenSubById[r.id] = `Left week ${week} · record kept`;
  }

  // build-spec.md §18 -- "Visibility follows the chat rule: tutors
  // registered on that course, nobody else. No admin exception." An admin
  // scoped to this same course still sees the roster, just not the contact
  // tooling.
  const isRegisteredTutor = trainer?.role === "trainer";

  // Assessors reuse this same page (createAdminClient path) but have no
  // reason to invite anyone -- only render the join-link button for a real
  // trainer/admin session.
  let joinUrl: string | null = null;
  let courseCode = "";
  if (trainer) {
    const siteUrl = process.env.SITE_URL;
    joinUrl = siteUrl && courseRow?.trainee_join_token ? `${siteUrl}/join/${courseRow.trainee_join_token}` : null;
    courseCode = courseRow?.course_code || courseRow?.name || "";
  }

  // §18 "Emailing the whole group" -- BCC only, never To/Cc, and the app
  // never renders a To-formatted address list or a copy-addresses button
  // anywhere: "if a tutor cannot paste the list into the wrong field, they
  // cannot make the mistake."
  const bccMailto = isRegisteredTutor
    ? `mailto:?bcc=${rows.map((r) => encodeURIComponent(r.email)).join(",")}&subject=${encodeURIComponent(courseCode)}`
    : null;

  // Handoff: "at-risk rows first, then existing order (alphabetical)".
  // Array.prototype.sort is stable, so the alphabetical order from
  // fetchRosterRows survives inside each half.
  const sortedRows = [...rows].sort((a, b) => Number(b.atRiskReasons.length > 0) - Number(a.atRiskReasons.length > 0));
  const atRiskCount = rows.filter((r) => r.atRiskReasons.length > 0).length;

  // for-claude-code-course-admin.md's "Course workspace -- invitations and
  // roster": already live for Course Admin (dashboard/admin/courses/[id]);
  // the MCT gets the same tools here, since Course Admin isn't necessarily
  // still watching once a course is running. isMct-only -- an ACT can see
  // the roster but not manage who's on it (§18's own admin-exception
  // reasoning, applied the same way to the MCT here).
  let rosterTutors: import("./manage-tutors-card").RosterTutorRow[] = [];
  let pendingTutorInvites: import("./manage-tutors-card").PendingTutorInvite[] = [];
  let assignableTrainers: AssignableTrainer[] = [];
  let chatRetentionDays = 1;
  let chatRetentionMode: "days" | "course" = "days";
  let deliveryMode: DeliveryMode = "f2f";
  if (isMct && trainer) {
    chatRetentionDays = courseRow?.chat_retention_days ?? 1;
    chatRetentionMode = courseRow?.chat_retention_mode ?? "days";
    deliveryMode = courseRow?.delivery_mode ?? "f2f";

    const profileById = new Map((tutorProfiles ?? []).map((p) => [p.id, p]));
    rosterTutors = (tutorRows ?? []).map((t) => ({
      courseTutorId: t.id,
      profileId: t.profile_id,
      name: profileById.get(t.profile_id)?.full_name ?? "Unknown",
      email: profileById.get(t.profile_id)?.email ?? "",
      role: t.tutor_role,
      joined: Boolean(t.verified_at),
      ownedAssignmentTypes: t.owned_assignment_types ?? [],
      isSecondary: profileById.get(t.profile_id)?.course_id !== courseId,
    }));
    pendingTutorInvites = (invitationRows ?? []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      fullName: inv.full_name,
      tutorRole: inv.tutor_role,
    }));

    // Same-centre tutors not already on this course -- assign-tutor-actions.ts's
    // own comment: "adding a trainer to a second course adds to their
    // assignments -- it does not remove them from the first."
    const courseNameById = new Map((homeCourses ?? []).map((c) => [c.id, c.name]));
    assignableTrainers = otherTrainers.map((p) => ({
      id: p.id,
      name: p.full_name,
      email: p.email,
      currentCourseLabel: p.course_id ? (courseNameById.get(p.course_id) ?? null) : null,
    }));
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHead
        eyebrow={`${courseCode} · Roster · click a row to open a portfolio`}
        title={
          <>
            {rows.length} candidate{rows.length === 1 ? "" : "s"}
            {atRiskCount > 0 ? (
              <span className="font-medium italic" style={{ color: "var(--hub-accent-deep)" }}>
                {" "}
                · {atRiskCount} at risk
              </span>
            ) : null}
          </>
        }
      >
        {/* Only the actions that are about the roster itself. Navigation to
            other pages lives in the pill row below (one door each); the
            assessor controls moved to the Assessor tab on 5 Sep 2026. */}
        <a href="/trainer/roster/export" className={HUB_BUTTON}>
          Export CSV
        </a>
        {bccMailto ? (
          <a href={bccMailto} title="Outside Connect -- urgent only. Opens your mail client with every candidate BCC'd." className={HUB_BUTTON}>
            Email all candidates
          </a>
        ) : null}
        {/* MCT only -- Ramy, 5 Sep 2026: adding a candidate is the main course tutor's, not any tutor's. */}
        {trainer && isMct ? (
          <AddCandidateButton courseId={courseId} joinUrl={joinUrl} />
        ) : null}
      </PageHead>

      {/* The FOL pool by class used to be a row here AND a page; Ramy,
          5 Sep 2026: "just one nice pill... the class distribution would be
          inside." The pill on the left of the controls row is the one door. */}
      <RosterTable
        rows={sortedRows}
        isMct={isMct}
        showContact={isRegisteredTutor}
        courseCode={courseCode}
        frozenSubById={frozenSubById}
        leading={trainer ? <AlsoUnder tab="Roster" links={[{ href: "/trainer/fol-spot-check", label: "FOL pool by class" }]} /> : null}
      />

      {filmsTpSessions ? (
        <FilmingConsentCard
          candidates={rows
            .filter((r) => !isCourseStatusReadOnly(r.courseStatus))
            .map((r) => ({ id: r.id, name: r.name, confirmed: consentConfirmedById.get(r.id) ?? false }))}
        />
      ) : null}

      {isMct ? (
        <section className="mt-2 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-serif text-[22px] font-semibold text-ink-warm">Course settings</h2>
            <p className="text-[12.5px] text-muted">Main course tutor only</p>
          </div>
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_360px]">
            <ManageTutorsCard courseId={courseId} tutors={rosterTutors} pendingInvites={pendingTutorInvites} assignable={assignableTrainers} />
            <div className="flex flex-col gap-4">
              <DeliveryModeCard courseId={courseId} savedMode={deliveryMode} />
              <ChatRetentionCard courseId={courseId} chatRetentionDays={chatRetentionDays} chatRetentionMode={chatRetentionMode} />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
