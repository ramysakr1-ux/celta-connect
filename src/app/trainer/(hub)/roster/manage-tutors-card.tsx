"use client";

import { useActionState } from "react";
import { TutorRoleControl } from "@/app/dashboard/admin/courses/[id]/tutor-role-control";
import { TutorInviteForm } from "@/app/dashboard/admin/courses/[id]/tutor-invite-form";
import { OwnedAssignmentsControl } from "@/app/dashboard/admin/courses/[id]/owned-assignments-control";
import { revokeInvitation, type InviteState } from "@/app/dashboard/admin/courses/[id]/invitation-actions";
import { leaveSecondaryCourse } from "@/app/dashboard/admin/courses/[id]/assign-tutor-actions";
import { tutorRoleLabel } from "@/lib/tutor-roles";

const initial: InviteState = { error: null };

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

// for-claude-code-course-admin.md's "Course workspace -- invitations and
// roster" describes exactly this functionality, already live on the Course
// Admin side (dashboard/admin/courses/[id]) -- Course Admin isn't
// necessarily still watching once a course is running, so the MCT gets the
// same tools here. Every action underneath is the same one Course Admin
// calls, now also gated to accept the MCT (isMctOnCourse), not a parallel
// implementation.
export function ManageTutorsCard({
  courseId,
  tutors,
  pendingInvites,
}: {
  courseId: string;
  tutors: RosterTutorRow[];
  pendingInvites: PendingTutorInvite[];
}) {
  const [revokeState, revokeAction, revoking] = useActionState(revokeInvitation, initial);

  return (
    <div className="sheet sheet-garnet flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Tutors</h2>
        <p className="mt-1 text-sm text-muted">Invite by name, or hand off a role -- including the MCT itself.</p>
      </div>

      <div className="flex flex-col gap-2">
        {tutors.map((t) => (
          <div key={t.courseTutorId} className="flex flex-wrap items-center justify-between gap-3 border-t border-border-faint pt-2 first:border-none first:pt-0">
            <div>
              <p className="text-sm text-ink">
                {t.name} {!t.joined ? <span className="text-xs text-muted">(invited)</span> : null}
              </p>
              <p className="text-xs text-muted">{t.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <OwnedAssignmentsControl courseTutorId={t.courseTutorId} courseId={courseId} owned={t.ownedAssignmentTypes} />
              <TutorRoleControl courseTutorId={t.courseTutorId} courseId={courseId} current={t.role} />
              {t.isSecondary ? (
                <form action={leaveSecondaryCourse}>
                  <input type="hidden" name="course_id" value={courseId} />
                  <input type="hidden" name="profile_id" value={t.profileId} />
                  <button type="submit" className="text-xs text-destructive hover:underline">
                    Remove
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border-faint pt-4">
        <TutorInviteForm courseId={courseId} />
      </div>

      {pendingInvites.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border-faint pt-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Invited, not yet joined</p>
          {revokeState.error ? <p className="text-xs text-destructive">{revokeState.error}</p> : null}
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border-faint py-1.5 last:border-none">
              <span className="text-sm text-ink">
                {inv.fullName ?? inv.email}
                {inv.fullName ? <span className="text-muted"> · {inv.email}</span> : null}
                <span className="text-muted"> · {tutorRoleLabel(inv.tutorRole)}</span>
              </span>
              <form action={revokeAction}>
                <input type="hidden" name="invitation_id" value={inv.id} />
                <input type="hidden" name="course_id" value={courseId} />
                <button type="submit" disabled={revoking} className="text-xs text-muted underline disabled:opacity-60">
                  Withdraw
                </button>
              </form>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
