"use client";

import { useActionState } from "react";
import { inviteToCourse, type InviteState } from "@/app/dashboard/admin/courses/[id]/invitation-actions";
import { TUTOR_ROLE_LABEL, DEFAULT_INVITE_TUTOR_ROLE } from "@/lib/tutor-roles";

const initial: InviteState = { error: null };

// Trimmed to just the tutor half of the old InvitationsPanel -- trainee
// invites are the admissions cycle's job now (Admissions pipeline panel /
// the offer flow), not a raw invite-by-email form sitting on Course Admin.
export function TutorInviteForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(inviteToCourse, initial);

  return (
    <form action={action} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="role" value="trainer" />
      <input
        name="email"
        type="email"
        placeholder="tutor@email.com"
        required
        className="h-9 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
      />
      <select
        name="tutor_role"
        defaultValue={DEFAULT_INVITE_TUTOR_ROLE}
        className="h-9 rounded-[6px] border border-border bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
      >
        {Object.entries(TUTOR_ROLE_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="admin-hover-fill h-9 rounded-[6px] border border-border px-3 text-sm text-ink hover:border-primary disabled:opacity-60">
        {pending ? "Inviting…" : "Invite a tutor"}
      </button>
      {state.error ? <p className="text-xs text-destructive sm:col-span-3">{state.error}</p> : null}
    </form>
  );
}
