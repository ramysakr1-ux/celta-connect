import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { JoinLinksCard } from "@/components/join-links-card";
import {
  CreateSubgroupForm,
  AddMemberForm,
  PairSubgroupsForm,
  UnpairButton,
} from "@/app/dashboard/admin/courses/[id]/subgroups-form";
import { removeSubgroupMember } from "@/app/dashboard/admin/courses/[id]/subgroup-actions";
import {
  removeRosterMember,
  updateAssessorVisitDate,
  updateEntryFormSentAt,
  updateApplicationSettings,
} from "@/app/dashboard/admin/courses/[id]/roster-actions";
import { linkRestartTransfer } from "@/app/dashboard/admin/courses/[id]/restart-actions";
import { linkDeferralTransfer } from "@/app/dashboard/admin/courses/[id]/deferral-actions";
import { DuplicateCourseForm } from "@/app/dashboard/admin/courses/[id]/duplicate-course-form";
import { DeliveryModeCard } from "@/app/dashboard/admin/courses/[id]/delivery-mode-card";
import { CloseOutCard } from "@/app/dashboard/admin/courses/[id]/close-out-card";
import { getCloseOutBlockingReasons } from "@/lib/course-close-out/blocking-rules";
import { COURSE_STATUS_LABEL } from "@/lib/course-status";
import { computeWeekOf, computeCourseState } from "@/lib/course-progress";
import { toLocalIso } from "@/lib/timetable-grid";
import { InvitationsPanel } from "@/app/dashboard/admin/courses/[id]/invitations-panel";
import { TutorRoleControl } from "@/app/dashboard/admin/courses/[id]/tutor-role-control";
import { GroupTutorForm } from "@/app/dashboard/admin/courses/[id]/group-tutor-form";
import { getRecentCentreChanges } from "@/lib/what-changed";
import { WhatChangedPanel } from "@/components/what-changed-panel";
import { computeEntryFormDeadline } from "@/lib/entry-form-deadline";

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

  // course_tutors carries the role; profiles carries the person. The roster
  // needs both, keyed by profile.
  const { data: courseTutors } = await supabase
    .from("course_tutors")
    .select("id, profile_id, tutor_role")
    .eq("course_id", id)
    .is("left_at", null);
  const tutorRowByProfile = new Map((courseTutors ?? []).map((t) => [t.profile_id, t]));

  // Named invitations that haven't been taken up. Withdrawn ones are excluded
  // but not deleted -- who was invited and never came is worth keeping.
  const { data: invitations } = await supabase
    .from("course_invitations")
    .select("id, email, full_name, role, tutor_role, invited_at")
    .eq("course_id", id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("invited_at", { ascending: false });
  const pendingInvites = (invitations ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    fullName: i.full_name,
    role: i.role,
    tutorRole: i.tutor_role,
    invitedAt: i.invited_at,
  }));

  const { data: subgroups } = await supabase
    .from("course_subgroups")
    .select("*")
    .eq("course_id", id)
    .order("created_at");

  // checkpoint 3 -- TP groups pair two subgroups as "halves" that alternate
  // real TP days (see src/lib/rotation.ts). Kept as a separate query rather
  // than a join since course_tp_groups can exist with zero/one linked
  // subgroup mid-pairing-flow-edge-cases; simpler to read both flat and
  // join in JS.
  const { data: tpGroups } = await supabase
    .from("course_tp_groups")
    .select("id, name, tutor_profile_id, meeting_days")
    .eq("course_id", id);

  const { data: members } = await supabase
    .from("course_subgroup_members")
    .select("id, subgroup_id, trainee_id, base_slot")
    .in("subgroup_id", (subgroups ?? []).map((g) => g.id))
    .order("base_slot");

  const nameByTraineeId = new Map((roster ?? []).map((m) => [m.id, m.full_name]));
  // Any trainer on the course may own a group -- the MCT/ACT distinction
  // governs announcements, not teaching.
  const courseTutorOptions = (roster ?? [])
    .filter((m) => m.role === "trainer")
    .map((m) => ({ id: m.id, name: m.full_name }));

  // Handbook 8.1.4 -- "tutor not expected to observe two groups in one
  // day." A TP group's tutor is a whole-group assignment with no per-date
  // granularity (course_tp_groups.tutor_profile_id, migration 0121), and
  // every paired group in a course shares the same calendar TP dates
  // (src/lib/rotation.ts's distinctTpDates()) -- so a tutor on more than
  // one group here IS double-booked, on every TP day, by construction.
  // Advisory, not blocking: the handbook says "not expected to," and a
  // small/short-staffed centre may have no other choice.
  const tutorGroupCounts = new Map<string, number>();
  for (const g of tpGroups ?? []) {
    if (!g.tutor_profile_id) continue;
    tutorGroupCounts.set(g.tutor_profile_id, (tutorGroupCounts.get(g.tutor_profile_id) ?? 0) + 1);
  }

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

  // §3 "First-half withdrawal with a restart" -- transfers created on ANY
  // course at this centre, still waiting for the candidate to actually join
  // one. Shown here so an admin can link one the moment that trainee shows
  // up on this course's roster.
  const { data: pendingRestarts } = await supabase
    .from("restart_transfers")
    .select("id, source_trainee_id, source_course_id, carried_assignments, note, created_at")
    .eq("center_id", admin.center_id)
    .is("destination_trainee_id", null)
    .order("created_at");
  const restartSourceIds = [...new Set((pendingRestarts ?? []).flatMap((t) => [t.source_trainee_id, t.source_course_id]))];
  const [{ data: restartSourceTrainees }, { data: restartSourceCourses }] = await Promise.all([
    restartSourceIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", (pendingRestarts ?? []).map((t) => t.source_trainee_id))
      : Promise.resolve({ data: [] }),
    restartSourceIds.length > 0
      ? supabase.from("courses").select("id, name").in("id", (pendingRestarts ?? []).map((t) => t.source_course_id))
      : Promise.resolve({ data: [] }),
  ]);
  const restartTraineeNameById = new Map((restartSourceTrainees ?? []).map((t) => [t.id, t.full_name]));
  const restartCourseNameById = new Map((restartSourceCourses ?? []).map((c) => [c.id, c.name]));
  const activeTraineesOnThisCourse = (roster ?? []).filter((m) => m.role === "trainee" && m.course_status === "active");

  // §3 "Deferral" -- same shape as pending restarts above, plus the source
  // course's delivery_mode so a mode change (vs. this course's own mode)
  // can be flagged before linking, per Handbook 6.9.
  const { data: pendingDeferrals } = await supabase
    .from("deferral_transfers")
    .select(
      "id, source_trainee_id, source_course_id, reasons, hours_carried, reintegration_deadline, carried_assignments, carried_tps, carried_celta5_matrix, note, created_at"
    )
    .eq("center_id", admin.center_id)
    .is("destination_trainee_id", null)
    .order("created_at");
  const deferralSourceCourseIds = [...new Set((pendingDeferrals ?? []).map((t) => t.source_course_id))];
  const [{ data: deferralSourceTrainees }, { data: deferralSourceCourses }] = await Promise.all([
    (pendingDeferrals ?? []).length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", (pendingDeferrals ?? []).map((t) => t.source_trainee_id))
      : Promise.resolve({ data: [] }),
    deferralSourceCourseIds.length > 0
      ? supabase.from("courses").select("id, name, delivery_mode").in("id", deferralSourceCourseIds)
      : Promise.resolve({ data: [] }),
  ]);
  const deferralTraineeNameById = new Map((deferralSourceTrainees ?? []).map((t) => [t.id, t.full_name]));
  const deferralCourseById = new Map((deferralSourceCourses ?? []).map((c) => [c.id, c]));

  const [{ data: closeOut }, blockingReasons] = await Promise.all([
    supabase.from("course_close_outs").select("*").eq("course_id", id).maybeSingle(),
    getCloseOutBlockingReasons(id),
  ]);

  const today = toLocalIso(new Date());
  const courseState = computeCourseState(course.start_date, course.end_date, today);
  const weekOf = courseState === "running" ? computeWeekOf(course.start_date, course.end_date, today) : null;
  const tutorCount = (roster ?? []).filter((m) => m.role === "trainer" || m.role === "admin").length;
  const candidateCount = (roster ?? []).filter((m) => m.role === "trainee").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-start justify-between gap-4 p-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
            {course.start_date} &ndash; {course.end_date}
            {weekOf ? ` · ${weekOf}` : ""}
          </p>
          <h1 className="mt-0.5 font-serif text-xl text-ink">{course.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DuplicateCourseForm courseId={course.id} suggestedName={`${course.name} (copy)`} />
          <Link
            href="#invite"
            className="flex h-9 items-center rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Invite people
          </Link>
        </div>
      </div>

      <DeliveryModeCard courseId={course.id} savedMode={course.delivery_mode} />

      <form action={updateApplicationSettings} className="card flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-serif text-lg text-ink">Open for applications</h2>
          <p className="mt-1 text-sm text-muted">
            Makes this intake selectable on the public application page, with a real place count. A full course stays
            selectable as a waiting-list application.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input type="hidden" name="course_id" value={course.id} />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="accepting_applications" defaultChecked={course.accepting_applications} />
            Accepting
          </label>
          <input
            type="number"
            name="application_cap"
            min={0}
            placeholder="Cap"
            defaultValue={course.application_cap ?? ""}
            className="w-20 rounded-[6px] border border-border bg-card px-2 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          <button type="submit" className="rounded-[6px] border border-border px-3 py-2 text-sm text-ink hover:border-primary">
            Save
          </button>
        </div>
      </form>

      <div className="card flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-lg text-ink">Entry form sent to Cambridge</h2>
            <p className="mt-1 text-sm text-muted">
              Fixes the cohort and the candidates&apos; names as Cambridge holds them, and decides
              whether a later withdrawal is internal only or reportable. Comes from Cambridge&apos;s
              own calendar, not the timetable.
            </p>
          </div>
        </div>
        {!course.entry_form_sent_at ? (
          (() => {
            const deadline = computeEntryFormDeadline(course.start_date, course.delivery_mode);
            const overdue = deadline < today;
            return (
              <p className={`text-sm ${overdue ? "font-semibold text-destructive" : "text-muted"}`}>
                {overdue ? "Overdue" : "Due"} {deadline} -- {course.delivery_mode === "online" ? "four" : "two"} weeks
                before the course starts (Handbook 3.1).
              </p>
            );
          })()
        ) : null}
        <form action={updateEntryFormSentAt} className="flex items-center gap-2">
          <input type="hidden" name="course_id" value={course.id} />
          <input
            type="date"
            name="entry_form_sent_at"
            defaultValue={course.entry_form_sent_at ? course.entry_form_sent_at.slice(0, 10) : ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          <button type="submit" className="rounded-[6px] border border-border px-3 py-2 text-sm text-ink hover:border-primary">
            Save
          </button>
        </form>
      </div>

      <div className="card flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="font-serif text-lg text-ink">Assessor visit date</h2>
          <p className="mt-1 text-sm text-muted">
            Candidates get a calming reminder from Course Stream ahead of this date -- concerns are
            raised with the assessor in the meeting itself, not through a written channel.
          </p>
        </div>
        <form action={updateAssessorVisitDate} className="flex items-center gap-2">
          <input type="hidden" name="course_id" value={course.id} />
          <input
            type="date"
            name="assessor_visit_date"
            defaultValue={course.assessor_visit_date ?? ""}
            className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
          <button type="submit" className="rounded-[6px] border border-border px-3 py-2 text-sm text-ink hover:border-primary">
            Save
          </button>
        </form>
      </div>

      {(pendingRestarts ?? []).length > 0 ? (
        <div className="card flex flex-col gap-4 p-6">
          <div>
            <h2 className="font-serif text-lg text-ink">Pending fee-free restarts</h2>
            <p className="mt-1 text-sm text-muted">
              Candidates approved for a first-half restart on another course at this centre, frozen and
              waiting for a destination. Link one once they&apos;ve joined this course.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {(pendingRestarts ?? []).map((t) => (
              <form
                key={t.id}
                action={linkRestartTransfer}
                className="flex flex-wrap items-center gap-3 rounded-[6px] border border-border p-3"
              >
                <input type="hidden" name="transfer_id" value={t.id} />
                <input type="hidden" name="course_id" value={course.id} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{restartTraineeNameById.get(t.source_trainee_id) ?? "Unknown"}</p>
                  <p className="text-xs text-muted">
                    From {restartCourseNameById.get(t.source_course_id) ?? "a previous course"} &middot;{" "}
                    {(t.carried_assignments as unknown[]).length} carried assignment
                    {(t.carried_assignments as unknown[]).length === 1 ? "" : "s"}
                    {t.note ? ` · "${t.note}"` : ""}
                  </p>
                </div>
                <select
                  name="destination_trainee_id"
                  defaultValue=""
                  required
                  className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
                >
                  <option value="" disabled>
                    — link to —
                  </option>
                  {activeTraineesOnThisCourse.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
                  Link
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}

      {(pendingDeferrals ?? []).length > 0 ? (
        <div className="card flex flex-col gap-4 p-6">
          <div>
            <h2 className="font-serif text-lg text-ink">Pending deferrals</h2>
            <p className="mt-1 text-sm text-muted">
              Candidates deferred from another course at this centre, frozen and waiting for a
              destination. Link one once they&apos;ve joined this course.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {(pendingDeferrals ?? []).map((t) => {
              const sourceCourse = deferralCourseById.get(t.source_course_id);
              const modeChanged = Boolean(sourceCourse && sourceCourse.delivery_mode !== course.delivery_mode);
              const tpCount = (t.carried_tps as unknown[]).length;
              const assignmentCount = (t.carried_assignments as unknown[]).length;
              return (
                <form
                  key={t.id}
                  action={linkDeferralTransfer}
                  className="flex flex-col gap-3 rounded-[6px] border border-border p-3"
                >
                  <input type="hidden" name="transfer_id" value={t.id} />
                  <input type="hidden" name="course_id" value={course.id} />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{deferralTraineeNameById.get(t.source_trainee_id) ?? "Unknown"}</p>
                      <p className="text-xs text-muted">
                        From {sourceCourse?.name ?? "a previous course"} &middot; {t.hours_carried.toFixed(1)} hrs carried &middot;{" "}
                        {tpCount} TP{tpCount === 1 ? "" : "s"} &middot; {assignmentCount} assignment{assignmentCount === 1 ? "" : "s"}
                        {t.reintegration_deadline ? ` · re-integrate by ${t.reintegration_deadline}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-ink italic">&ldquo;{t.reasons}&rdquo;</p>
                    </div>
                    <select
                      name="destination_trainee_id"
                      defaultValue=""
                      required
                      className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink outline-none focus:border-primary"
                    >
                      <option value="" disabled>
                        — link to —
                      </option>
                      {activeTraineesOnThisCourse.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
                      Link
                    </button>
                  </div>
                  {modeChanged ? (
                    <div className="flex flex-col gap-2 rounded-[6px] border border-gold/30 bg-gold/10 p-3">
                      <p className="text-xs text-ink">
                        This course&apos;s delivery mode ({course.delivery_mode}) differs from{" "}
                        {sourceCourse?.name ?? "the original course"}&apos;s ({sourceCourse?.delivery_mode}). Handbook 6.9
                        requires the candidate&apos;s written agreement, and a familiarisation plan.
                      </p>
                      <label className="flex items-center gap-2 text-xs text-ink">
                        <input type="checkbox" name="mode_change_agreed" required />
                        The candidate agreed in writing to the different delivery mode
                      </label>
                      <textarea
                        name="familiarisation_plan"
                        rows={2}
                        required
                        placeholder="Familiarisation plan for the new mode"
                        className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                      />
                    </div>
                  ) : null}
                </form>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-serif text-lg text-ink">Roster</h2>
              <p className="text-xs text-muted">
                {tutorCount} tutor{tutorCount === 1 ? "" : "s"} &middot; {candidateCount} candidate
                {candidateCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="card mt-3 overflow-hidden">
              <table className="table-plain w-full">
                <thead>
                  <tr>
                    <th className="text-sm text-muted">Name</th>
                    <th className="text-sm text-muted">Email</th>
                    <th className="text-sm text-muted">Role</th>
                    <th className="text-sm text-muted">Status</th>
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
                          <div className="flex flex-col gap-1">
                            <span className="status-pill status-pill-pending capitalize">
                              {member.role === "trainee" ? "candidate" : member.role}
                            </span>
                            {/* The role travels with the invitation, but has to
                                be changeable afterwards -- an MCT who stops
                                working is a real Tuesday. */}
                            {member.role === "trainer" && tutorRowByProfile.get(member.id) ? (
                              <TutorRoleControl
                                courseTutorId={tutorRowByProfile.get(member.id)!.id}
                                courseId={course.id}
                                current={tutorRowByProfile.get(member.id)!.tutor_role}
                              />
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {/* "Joined / Invited -- deliberately distinguishable,
                              unlike an earlier build where an invited and
                              joined person looked identical." */}
                          <span className="pill pill-success">Joined</span>{" "}
                          {member.role === "trainee" && member.course_status !== "active" ? (
                            <span className={`pill ${member.course_status === "extension" ? "pill-info" : "pill-neutral"}`}>
                              {COURSE_STATUS_LABEL[member.course_status]}
                            </span>
                          ) : null}
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
                  ) : null}

                  {/* Invited but not arrived. In the same table on purpose: a
                      separate list is where people stop looking, and the whole
                      point of the pill is that the difference is visible in
                      the place you already check. */}
                  {pendingInvites.map((inv) => (
                    <tr key={inv.id}>
                      <td className="text-muted">{inv.fullName ?? "—"}</td>
                      <td className="text-muted">{inv.email}</td>
                      <td>
                        <span className="status-pill status-pill-pending capitalize">
                          {inv.role === "trainee" ? "candidate" : "trainer"}
                        </span>
                        {inv.tutorRole ? (
                          <span className="mt-1 block text-[11px] text-muted">{inv.tutorRole.replace(/_/g, " ")}</span>
                        ) : null}
                      </td>
                      <td>
                        <span className="pill pill-neutral">Invited</span>
                      </td>
                      <td />
                    </tr>
                  ))}

                  {(!roster || roster.length === 0) && pendingInvites.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted">
                        No one on this course yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-serif text-lg text-ink">Teaching Practice subgroups</h2>

            {/* "A warning banner appears when candidates aren't yet grouped:
                rotation can't be released until every candidate has a group --
                stated at the point that causes the block, not buried in help
                text." So it sits directly above the groups, not in a help
                panel and not at the top of the page. */}
            {unassignedTrainees.length > 0 ? (
              <div className="mt-3 rounded-[8px] border border-[color-mix(in_oklab,oklch(60%_0.11_70)_30%,transparent)] bg-[color-mix(in_oklab,oklch(60%_0.11_70)_9%,transparent)] px-4 py-3">
                <p className="text-sm font-semibold text-[oklch(52%_0.1_70)]">
                  {unassignedTrainees.length} candidate{unassignedTrainees.length === 1 ? " is" : "s are"} not in a group
                </p>
                <p className="mt-0.5 text-xs text-ink">
                  The rotation can&apos;t be released until every candidate has one.{" "}
                  {unassignedTrainees.map((t) => t.full_name).join(", ")}
                </p>
              </div>
            ) : null}

            {/* The two group cards. Each shows its tutor and meeting days, and
                its members split into the halves the rotation actually runs
                on -- half_order 1 and 2 on course_subgroups. */}
            {(tpGroups ?? []).length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                {(tpGroups ?? []).map((g) => {
                  const halves = (subgroups ?? []).filter((sg) => sg.tp_group_id === g.id);
                  return (
                    <div key={g.id} className="card p-5">
                      <h3 className="font-serif text-base text-ink">{g.name}</h3>
                      {/* "Nadia Farouk · odd days" -- the tutor who owns this
                          group and when it meets, editable in place.
                          Migration 0121 added both; before it, nothing in the
                          app could say who had a group. */}
                      <GroupTutorForm
                        groupId={g.id}
                        courseId={course.id}
                        tutors={courseTutorOptions}
                        currentTutorId={g.tutor_profile_id}
                        currentMeetingDays={g.meeting_days}
                      />
                      {g.tutor_profile_id && (tutorGroupCounts.get(g.tutor_profile_id) ?? 0) > 1 ? (
                        <p className="mt-1.5 text-[11px] text-status-warning-text">
                          On another group too -- Handbook 8.1.4 says a tutor isn&apos;t expected to observe two
                          groups the same day.
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-col gap-3">
                        {[1, 2].map((half) => {
                          const sg = halves.find((h) => h.half_order === half);
                          const names = sg
                            ? (members ?? [])
                                .filter((m) => m.subgroup_id === sg.id)
                                .map((m) => nameByTraineeId.get(m.trainee_id) ?? "Unknown")
                            : [];
                          return (
                            <div key={half}>
                              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                                {half === 1 ? "First half" : "Second half"}
                              </p>
                              {names.length > 0 ? (
                                names.map((n) => (
                                  <p key={n} className="text-sm text-ink">
                                    {n}
                                  </p>
                                ))
                              ) : (
                                <p className="text-sm text-muted">Nobody yet</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <p className="mt-1 text-sm text-muted">
              Trainees are split into fixed subgroups by teaching day; membership stays fixed for the
              course. Trainers manage rotation order from their own Rotation page.
            </p>
            {unassignedTrainees.length > 0 ? (
              <div className="mt-3 flex items-start gap-2.5 rounded-[6px] border border-gold/30 bg-gold/10 px-4 py-3">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold" />
                <p className="text-sm text-ink">
                  {unassignedTrainees.length} candidate{unassignedTrainees.length === 1 ? "" : "s"} aren&apos;t in a
                  group yet. The rotation can&apos;t be released until every candidate is placed.
                </p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-4">
              {(() => {
                const availableTraineeOptions = unassignedTrainees.map((t) => ({ id: t.id, full_name: t.full_name }));
                const renderSubgroup = (subgroup: NonNullable<typeof subgroups>[number]) => {
                  const subgroupMembers = (members ?? []).filter((m) => m.subgroup_id === subgroup.id);
                  return (
                    <div key={subgroup.id}>
                      <h4 className="text-sm font-semibold text-ink">{subgroup.name}</h4>
                      <div className="mt-2 flex flex-col gap-2">
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
                      <div className="mt-3">
                        <AddMemberForm courseId={course.id} subgroupId={subgroup.id} availableTrainees={availableTraineeOptions} />
                      </div>
                    </div>
                  );
                };

                const paired = (subgroups ?? []).filter((g) => g.tp_group_id);
                const unpaired = (subgroups ?? []).filter((g) => !g.tp_group_id);

                return (
                  <>
                    {(tpGroups ?? []).map((tpGroup) => {
                      const halves = paired
                        .filter((g) => g.tp_group_id === tpGroup.id)
                        .sort((a, b) => (a.half_order ?? 0) - (b.half_order ?? 0));
                      return (
                        <div key={tpGroup.id} className="card p-6">
                          <div className="flex items-center justify-between">
                            <h3 className="font-serif text-ink">{tpGroup.name}</h3>
                            <UnpairButton courseId={course.id} tpGroupId={tpGroup.id} />
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            The two halves alternate which real TP day (from the timetable) they teach on.
                          </p>
                          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                            {halves.map((half, i) => (
                              <div key={half.id}>
                                <p className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                                  Half {i === 0 ? "A" : "B"}
                                </p>
                                {renderSubgroup(half)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    {unpaired.map((subgroup) => (
                      <div key={subgroup.id} className="card p-6">
                        {renderSubgroup(subgroup)}
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
            <div className="card mt-4 flex flex-col gap-4 p-6">
              <CreateSubgroupForm courseId={course.id} />
              <PairSubgroupsForm
                courseId={course.id}
                unpairedSubgroups={(subgroups ?? []).filter((g) => !g.tp_group_id).map((g) => ({ id: g.id, name: g.name }))}
              />
            </div>
          </div>
        </div>

        <div id="invite" className="scroll-mt-6">
          <InvitationsPanel
            courseId={course.id}
            pending={pendingInvites}
            joinedCounts={{
              trainees: (roster ?? []).filter((m) => m.role === "trainee").length,
              trainers: (roster ?? []).filter((m) => m.role === "trainer").length,
            }}
          />
        </div>

        <JoinLinksCard
          courseId={course.id}
          traineeLink={`${process.env.SITE_URL ?? ""}/join/${course.trainee_join_token}`}
          trainerLink={`${process.env.SITE_URL ?? ""}/join/${course.trainer_join_token}`}
          joinedCounts={{
            trainees: (roster ?? []).filter((m) => m.role === "trainee").length,
            trainers: (roster ?? []).filter((m) => m.role === "trainer").length,
          }}
        />

        <WhatChangedPanel changes={await getRecentCentreChanges(course.center_id)} />
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

      <CloseOutCard
        courseId={course.id}
        cambridgeGradesConfirmedAt={course.cambridge_grades_confirmed_at}
        blockingReasons={blockingReasons}
        closeOut={closeOut ?? null}
      />
    </div>
  );
}
