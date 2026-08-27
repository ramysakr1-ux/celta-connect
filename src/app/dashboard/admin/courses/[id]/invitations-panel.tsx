"use client";

import { useActionState, useState } from "react";
import { inviteToCourse, revokeInvitation, type InviteState } from "./invitation-actions";
import { TUTOR_ROLE_LABEL, DEFAULT_INVITE_TUTOR_ROLE, tutorRoleLabel } from "@/lib/tutor-roles";

const initial: InviteState = { error: null };

export interface PendingInvite {
  id: string;
  email: string;
  fullName: string | null;
  role: "trainee" | "trainer";
  tutorRole: string | null;
  invitedAt: string;
}


/**
 * Invite by name, with the role attached.
 *
 * "A role is invited, never self-selected, and nothing in Connect promotes an
 * account on its own." The shared links below this panel still exist for
 * letting a cohort of candidates in; this is for the people whose role the
 * centre decides in advance — above all the MCT and the ACT.
 */
export function InvitationsPanel({
  courseId,
  pending,
  joinedCounts,
}: {
  courseId: string;
  pending: PendingInvite[];
  joinedCounts: { trainees: number; trainers: number };
}) {
  const [state, action, sending] = useActionState(inviteToCourse, initial);
  const [revokeState, revokeAction, revoking] = useActionState(revokeInvitation, initial);
  const [role, setRole] = useState<"trainer" | "trainee">("trainer");
  const [tutorRole, setTutorRole] = useState<string>(DEFAULT_INVITE_TUTOR_ROLE);

  const invitedTutors = pending.filter((p) => p.role === "trainer").length;
  const invitedCandidates = pending.filter((p) => p.role === "trainee").length;

  // Course Admin.dc.html: "Send invite as {{ inviteRole }}" -- the button
  // names the role being invited rather than a generic "Send invitation".
  const inviteRoleLabel = role === "trainee" ? "Candidate" : tutorRole ? tutorRoleLabel(tutorRole) : "Tutor";

  return (
    <div className="card p-6">
      <h2 className="font-serif text-lg text-ink">Invite a tutor by name</h2>
      <p className="mt-1 text-sm text-muted">
        The invitation is bound to the address, and carries the role — forwarding it doesn&apos;t work, by design.
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="course_id" value={courseId} />

        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="tutor@email.com"
            className="h-9 w-full rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Name (optional)</label>
          <input
            name="full_name"
            type="text"
            className="h-9 w-full rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Joining as</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "trainer" | "trainee")}
            className="h-9 rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="trainer">Tutor</option>
            <option value="trainee">Candidate</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted">Tutor role</label>
          <select
            name="tutor_role"
            value={tutorRole}
            onChange={(e) => setTutorRole(e.target.value)}
            className="h-9 rounded-[6px] border border-input bg-card-inset px-2.5 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="">Not set yet</option>
            {Object.entries(TUTOR_ROLE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={sending}
          className="h-9 rounded-[6px] bg-ink-warm px-4 text-sm font-semibold text-card disabled:opacity-60"
        >
          {sending ? "Sending…" : `Send invite as ${inviteRoleLabel}`}
        </button>
      </form>

      {state.error ? <p className="mt-2 text-sm text-destructive">{state.error}</p> : null}
      {!state.error && state.sent ? (
        <p className="mt-2 text-sm text-primary">Invitation sent to {state.sent}.</p>
      ) : null}
      {revokeState.error ? <p className="mt-2 text-sm text-destructive">{revokeState.error}</p> : null}

      {/* "10 of 12 joined" — the count the spec asks for, now real: invited is
          a record rather than a guess at who clicked a shared link. */}
      <div className="mt-5 flex flex-wrap gap-5 border-t border-border-faint pt-4 text-sm">
        <span className="text-muted">
          Tutors:{" "}
          <span className="text-ink">
            {joinedCounts.trainers} joined
            {invitedTutors > 0 ? `, ${invitedTutors} invited` : ""}
          </span>
        </span>
        <span className="text-muted">
          Candidates:{" "}
          <span className="text-ink">
            {joinedCounts.trainees} joined
            {invitedCandidates > 0 ? `, ${invitedCandidates} invited` : ""}
          </span>
        </span>
      </div>

      {pending.length > 0 ? (
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Invited, not yet joined</p>
          {pending.map((inv) => (
            <div key={inv.id} className="admin-hover flex flex-wrap items-center justify-between gap-2 border-b border-border-faint py-1.5 last:border-none">
              <span className="text-sm text-ink">
                {inv.fullName ?? inv.email}
                {inv.fullName ? <span className="text-muted"> · {inv.email}</span> : null}
                <span className="text-muted">
                  {" "}
                  · {inv.role === "trainer" ? (inv.tutorRole ? tutorRoleLabel(inv.tutorRole) : "Tutor, role not set") : "Candidate"}
                </span>
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
