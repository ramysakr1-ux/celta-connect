import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { fetchRosterRows } from "@/lib/roster";
import { RosterTable } from "@/app/trainer/(hub)/roster/roster-table";
import { AlsoUnder } from "@/app/trainer/(hub)/also-under";
import { PageHead, HUB_BUTTON } from "@/app/trainer/(hub)/page-head";
import { AddCandidateButton } from "@/app/trainer/(hub)/roster/add-candidate-button";
import { toggleFilmingConsent } from "@/app/trainer/(hub)/roster/filming-consent-actions";
import { ManageTutorsCard } from "@/app/trainer/(hub)/roster/manage-tutors-card";
import { AssignTutorPanel, type AssignableTrainer } from "@/app/dashboard/admin/courses/[id]/assign-tutor-panel";
import { ChatRetentionForm } from "@/app/dashboard/admin/courses/[id]/chat-retention-form";
import { DeliveryModeCard } from "@/app/dashboard/admin/courses/[id]/delivery-mode-card";
import type { DeliveryMode } from "@/lib/delivery-mode";

// The detailed operational roster. Row computation lives in lib/roster.ts,
// shared with the CSV export route below so the two can't drift on what a
// column means.
export default async function TrainerRosterPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" || session?.profile?.role === "platform_owner" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const rows = await fetchRosterRows(supabase, courseId);
  const isMct = trainer?.tutor_role === "main_course_tutor";

  // specs/admissions-and-close-out.md §10 -- "only used if a centre films."
  // A second query rather than folding into fetchRosterRows/RosterRow:
  // every other caller of that shared function (the CSV export) has no use
  // for this, and it's centre-conditional besides.
  const { data: filmingCentre } = await supabase.from("centers").select("films_tp_sessions").eq("id", trainer?.center_id ?? "").maybeSingle();
  const filmsTpSessions = filmingCentre?.films_tp_sessions ?? false;
  const { data: consentRows } =
    filmsTpSessions && rows.length > 0
      ? await supabase
          .from("profiles")
          .select("id, filming_consent_confirmed_at")
          .in(
            "id",
            rows.map((r) => r.id)
          )
      : { data: [] };
  const consentConfirmedById = new Map((consentRows ?? []).map((r) => [r.id, !!r.filming_consent_confirmed_at]));

  // for-claude-code-fol-pooled-evidence.md, "Trainer UX / Days 2-9": "a
  // spot-check view showing per-class log counts (flagging classes with
  // ~0 entries) is useful but not required for v1." roster.ts already
  // tallies class_error_log per CANDIDATE (folEntriesLogged); this is the
  // per-CLASS view named separately in the spec -- which class isn't
  // logging, not which candidate. tp_class is free text at the point of
  // logging (fol/actions.ts), not a foreign key, so every real class name
  // comes from course_subgroups -- classes with zero log rows still need
  // to show, which a plain group-by on class_error_log alone would miss.
  const [{ data: subgroupsForFol }, { data: classErrorRows }] = await Promise.all([
    supabase.from("course_subgroups").select("name").eq("course_id", courseId),
    supabase.from("class_error_log").select("tp_class").eq("course_id", courseId),
  ]);
  const folCountByClass = new Map<string, number>();
  for (const s of subgroupsForFol ?? []) folCountByClass.set(s.name, 0);
  for (const r of classErrorRows ?? []) folCountByClass.set(r.tp_class, (folCountByClass.get(r.tp_class) ?? 0) + 1);
  const folByClass = [...folCountByClass.entries()].sort(([a], [b]) => a.localeCompare(b));

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
    const { data: course } = await supabase.from("courses").select("trainee_join_token, course_code, name").eq("id", courseId).maybeSingle();
    const siteUrl = process.env.SITE_URL;
    joinUrl = siteUrl && course?.trainee_join_token ? `${siteUrl}/join/${course.trainee_join_token}` : null;
    courseCode = course?.course_code || course?.name || "";
  }

  // §18 "Emailing the whole group" -- BCC only, never To/Cc, and the app
  // never renders a To-formatted address list or a copy-addresses button
  // anywhere: "if a tutor cannot paste the list into the wrong field, they
  // cannot make the mistake."
  const bccMailto = isRegisteredTutor
    ? `mailto:?bcc=${rows.map((r) => encodeURIComponent(r.email)).join(",")}&subject=${encodeURIComponent(courseCode)}`
    : null;

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
    const adminClient = createAdminClient();
    const { data: courseRetention } = await adminClient
      .from("courses")
      .select("chat_retention_days, chat_retention_mode, delivery_mode")
      .eq("id", courseId)
      .maybeSingle();
    chatRetentionDays = courseRetention?.chat_retention_days ?? 1;
    chatRetentionMode = courseRetention?.chat_retention_mode ?? "days";
    deliveryMode = courseRetention?.delivery_mode ?? "f2f";

    const [{ data: tutorRows }, { data: invitationRows }] = await Promise.all([
      adminClient
        .from("course_tutors")
        .select("id, profile_id, tutor_role, verified_at, owned_assignment_types")
        .eq("course_id", courseId)
        .is("left_at", null),
      adminClient
        .from("course_invitations")
        .select("id, email, full_name, tutor_role")
        .eq("course_id", courseId)
        .eq("role", "trainer")
        .is("revoked_at", null)
        .is("accepted_at", null),
    ]);

    const tutorProfileIds = (tutorRows ?? []).map((t) => t.profile_id);
    const { data: tutorProfiles } = tutorProfileIds.length
      ? await adminClient.from("profiles").select("id, full_name, email, course_id").in("id", tutorProfileIds)
      : { data: [] };
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
    const { data: centreTrainers } = await adminClient
      .from("profiles")
      .select("id, full_name, email, course_id")
      .eq("role", "trainer")
      .eq("center_id", trainer.center_id);
    const otherTrainers = (centreTrainers ?? []).filter((p) => !tutorProfileIds.includes(p.id));
    const homeCourseIds = [...new Set(otherTrainers.map((p) => p.course_id).filter((id): id is string => Boolean(id)))];
    const { data: homeCourses } = homeCourseIds.length
      ? await adminClient.from("courses").select("id, name").in("id", homeCourseIds)
      : { data: [] };
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
        title={`${rows.length} candidate${rows.length === 1 ? "" : "s"}`}
      >
        {/* Only the actions that are about the roster itself. Navigation to
            other pages lives in the "Also under" row below (one door each);
            the assessor controls moved to the Assessor tab on 5 Sep 2026. */}
        <a href="/trainer/roster/export" className={HUB_BUTTON}>
          Export CSV
        </a>
        {bccMailto ? (
          <a href={bccMailto} title="Outside Connect -- urgent only. Opens your mail client with every candidate BCC'd." className={HUB_BUTTON}>
            Email all candidates
          </a>
        ) : null}
        {trainer ? <AddCandidateButton courseId={courseId} joinUrl={joinUrl} /> : null}
      </PageHead>

      {trainer ? <AlsoUnder tab="Roster" links={[{ href: "/trainer/fol-spot-check", label: "Error log spot check" }]} /> : null}

      {folByClass.length > 0 ? (
        <div className="sheet flex flex-wrap items-center gap-3 p-4">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">FOL pool, by class</span>
          {folByClass.map(([name, count]) => (
            <span
              key={name}
              className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${
                count === 0 ? "border border-dashed border-status-warning-text text-status-warning-text" : "bg-accent text-ink"
              }`}
              title={count === 0 ? `${name} hasn't logged any observations yet` : `${count} observation${count === 1 ? "" : "s"} logged`}
            >
              {name} -- {count}
            </span>
          ))}
          {/* specs/for-claude-code-fol-spot-check.md -- the fuller
              grammar/pronunciation-split, last-logged, status-pill view
              this compact row doesn't have room for. */}
          <Link href="/trainer/fol-spot-check" className="text-xs font-medium text-primary hover:underline">
            Full spot-check view →
          </Link>
        </div>
      ) : null}

      {filmsTpSessions ? (
        <div className="sheet sheet-garnet flex flex-wrap items-center gap-3 p-4">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Filming consent</span>
          <span className="text-xs text-muted">Signed forms are on paper, kept with the class register -- this just tracks who&apos;s handed one in.</span>
          <a href="/api/filming-consent.pdf" className="text-xs font-medium text-primary hover:underline">
            Download blank form →
          </a>
          {rows.map((r) => {
            const confirmed = consentConfirmedById.get(r.id) ?? false;
            return (
              <form key={r.id} action={toggleFilmingConsent}>
                <input type="hidden" name="trainee_id" value={r.id} />
                <input type="hidden" name="confirmed" value={confirmed ? "false" : "true"} />
                <button
                  type="submit"
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${
                    confirmed ? "bg-accent text-ink" : "border border-dashed border-status-warning-text text-status-warning-text"
                  }`}
                  title={confirmed ? "Click to mark as not yet collected" : "Click to mark as collected"}
                >
                  {r.name} -- {confirmed ? "Signed" : "Not yet"}
                </button>
              </form>
            );
          })}
        </div>
      ) : null}

      <RosterTable rows={rows} isMct={isMct} showContact={isRegisteredTutor} courseCode={courseCode} />

      {isMct ? (
        <>
          <ManageTutorsCard courseId={courseId} tutors={rosterTutors} pendingInvites={pendingTutorInvites} />
          {assignableTrainers.length > 0 ? <AssignTutorPanel courseId={courseId} trainers={assignableTrainers} /> : null}
          <DeliveryModeCard courseId={courseId} savedMode={deliveryMode} />
          <div className="sheet flex flex-col gap-2 p-4">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Chat retention</span>
            <ChatRetentionForm courseId={courseId} chatRetentionDays={chatRetentionDays} chatRetentionMode={chatRetentionMode} />
          </div>
        </>
      ) : null}
    </div>
  );
}
