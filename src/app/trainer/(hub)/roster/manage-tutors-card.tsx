"use client";

import { useActionState, useState } from "react";
import { TutorRoleControl } from "@/app/dashboard/admin/courses/[id]/tutor-role-control";
import { OwnedAssignmentsControl } from "@/app/dashboard/admin/courses/[id]/owned-assignments-control";
import { inviteToCourse, revokeInvitation, type InviteState } from "@/app/dashboard/admin/courses/[id]/invitation-actions";
import { assignExistingTutor, leaveSecondaryCourse, type AssignTutorState } from "@/app/dashboard/admin/courses/[id]/assign-tutor-actions";
import type { AssignableTrainer } from "@/app/dashboard/admin/courses/[id]/assign-tutor-panel";
import { tutorRoleLabel, TUTOR_ROLE_LABEL, DEFAULT_INVITE_TUTOR_ROLE } from "@/lib/tutor-roles";
import { Avatar } from "@/components/avatar";

const initial: InviteState = { error: null };
const assignInitial: AssignTutorState = { error: null };

export interface RosterTutorRow {
  courseTutorId: string;
  profileId: string;
  name: string;
  email: string;
  role: string | null;
  joined: boolean;
  ownedAssignmentTypes: string[];
  isSecondary: boolean; // this course isn't their home course
}

export interface PendingTutorInvite {
  id: string;
  email: string;
  fullName: string | null;
  tutorRole: string | null;
}

const SELECT = "rounded-[6px] border border-border bg-card px-2.5 text-[12.5px] font-medium text-ink outline-none focus:border-primary disabled:opacity-60";
const INPUT = "h-9 rounded-[8px] border border-border bg-card px-3 text-[13px] text-ink outline-none placeholder:text-[oklch(60%_0.015_70)] focus:border-primary";
const RULE = "border-t border-border-faint pt-3";
const EYEBROW = "text-[11px] font-bold tracking-[0.08em] text-muted uppercase";

// "Also at this centre": one chip per same-centre tutor not on this course.
// assign-tutor-actions.ts's own comment: "adding a trainer to a second
// course adds to their assignments -- it does not remove them from the
// first." The role select stays on the chip so what is added is chosen,
// not defaulted.
function AssignChip({ courseId, trainer }: { courseId: string; trainer: AssignableTrainer }) {
  const [state, action, pending] = useActionState(assignExistingTutor, assignInitial);
  const [tutorRole, setTutorRole] = useState<string>(DEFAULT_INVITE_TUTOR_ROLE);
  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="profile_id" value={trainer.id} />
      <div className="flex h-9 items-center gap-2.5 rounded-[8px] border border-border pr-1.5 pl-3 text-[13px] text-ink">
        {trainer.name}
        <span className="text-[12px] text-muted">{trainer.currentCourseLabel ?? "no course"}</span>
        <select name="tutor_role" value={tutorRole} onChange={(e) => setTutorRole(e.target.value)} aria-label="Role on this course" className={`h-[26px] ${SELECT} text-[12px]`}>
          {Object.entries(TUTOR_ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="trainer-hover-fill inline-flex h-[26px] items-center rounded-[6px] bg-card-inset px-2.5 text-[12px] font-semibold text-ink disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add to course"}
        </button>
      </div>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      {!state.error && state.warning ? <p className="text-xs text-status-warning-text">{state.warning}</p> : null}
      {!state.error && !state.warning && state.assigned ? <p className="text-xs text-primary">{state.assigned} added to this course.</p> : null}
    </form>
  );
}

// for-claude-code-course-admin.md's "Course workspace -- invitations and
// roster" describes exactly this functionality, already live on the Course
// Admin side (dashboard/admin/courses/[id]) -- Course Admin isn't
// necessarily still watching once a course is running, so the MCT gets the
// same tools here. Every action underneath is the same one Course Admin
// calls, now also gated to accept the MCT (isMctOnCourse), not a parallel
// implementation. Layout: design_handoff_trainer_roster, "Tutors card".
export function ManageTutorsCard({
  courseId,
  tutors,
  pendingInvites,
  assignable,
}: {
  courseId: string;
  tutors: RosterTutorRow[];
  pendingInvites: PendingTutorInvite[];
  assignable: AssignableTrainer[];
}) {
  const [inviteState, inviteAction, inviting] = useActionState(inviteToCourse, initial);
  const [revokeState, revokeAction, revoking] = useActionState(revokeInvitation, initial);

  return (
    <div className="sheet flex flex-col gap-3.5 px-6 py-5">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="font-serif text-[20px] font-semibold text-ink-warm">Tutors</h2>
        <p className="text-[12.5px] text-muted">Invite by name, or hand off a role -- including the MCT itself.</p>
      </div>

      <div className="flex flex-col">
        {tutors.map((t) => (
          <div key={t.courseTutorId} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-t border-border-faint py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={t.name} size="sm" />
              <div className="flex min-w-0 flex-col gap-px">
                <p className="text-[14px] font-semibold text-ink">
                  {t.name}
                  {t.isSecondary ? <span className="ml-1.5 text-[12px] font-normal text-muted">(second course)</span> : null}
                  {!t.joined ? <span className="ml-1.5 text-[12px] font-normal text-muted">(invited)</span> : null}
                </p>
                <p className="truncate text-[12px] text-muted">{t.email}</p>
              </div>
            </div>
            <OwnedAssignmentsControl courseTutorId={t.courseTutorId} courseId={courseId} owned={t.ownedAssignmentTypes} variant="chips" />
            <TutorRoleControl courseTutorId={t.courseTutorId} courseId={courseId} current={t.role} selectClassName={`h-[30px] ${SELECT}`} />
            <div className="w-[52px] text-right text-[12px]">
              {t.isSecondary ? (
                <form action={leaveSecondaryCourse}>
                  <input type="hidden" name="course_id" value={courseId} />
                  <input type="hidden" name="profile_id" value={t.profileId} />
                  <button type="submit" className="text-destructive hover:underline">
                    Remove
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Invite row: Name · Email · role · Invite. Trainee invites are the
          admissions cycle's job (the offer flow), never a raw form here. */}
      <form action={inviteAction} className={`${RULE} flex flex-wrap gap-2`}>
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="role" value="trainer" />
        <input name="full_name" type="text" placeholder="Name" aria-label="Name" className={`${INPUT} min-w-[160px] flex-1`} />
        <input name="email" type="email" placeholder="Email" aria-label="Email" required className={`${INPUT} min-w-[200px] flex-[1.4]`} />
        <select name="tutor_role" defaultValue={DEFAULT_INVITE_TUTOR_ROLE} aria-label="Role on this course" className={`h-9 ${SELECT} rounded-[8px] text-[13px] font-normal`}>
          {Object.entries(TUTOR_ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={inviting}
          className="inline-flex h-9 items-center rounded-[8px] px-4 text-[13px] font-semibold text-primary-foreground transition-[filter] hover:brightness-110 disabled:opacity-60"
          style={{ background: "var(--hub-accent)" }}
        >
          {inviting ? "Inviting…" : "Invite"}
        </button>
        {inviteState.error ? <p className="w-full text-xs text-destructive">{inviteState.error}</p> : null}
      </form>

      {pendingInvites.length > 0 ? (
        <div className={`${RULE} flex flex-col gap-1.5`}>
          <p className={EYEBROW}>Invited, not yet joined</p>
          {revokeState.error ? <p className="text-xs text-destructive">{revokeState.error}</p> : null}
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="text-ink">
                {inv.fullName ?? inv.email}
                <span className="text-muted">
                  {inv.fullName ? ` · ${inv.email}` : ""} · {tutorRoleLabel(inv.tutorRole)}
                </span>
              </span>
              <form action={revokeAction}>
                <input type="hidden" name="invitation_id" value={inv.id} />
                <input type="hidden" name="course_id" value={courseId} />
                <button type="submit" disabled={revoking} className="text-[12px] text-muted underline disabled:opacity-60">
                  Withdraw
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      {assignable.length > 0 ? (
        <div className={`${RULE} flex flex-col gap-2`}>
          <p className={EYEBROW}>Also at this centre</p>
          <p className="text-[12.5px] text-muted">
            Adding a trainer to a second course adds to their assignments -- it doesn&apos;t remove them from the first.
          </p>
          <div className="flex flex-wrap gap-2">
            {assignable.map((t) => (
              <AssignChip key={t.id} courseId={courseId} trainer={t} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
