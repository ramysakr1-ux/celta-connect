"use client";

import { useActionState } from "react";
import { inviteMember } from "@/app/dashboard/admin/actions";
import type { FormState } from "@/app/dashboard/admin/actions";

const initialState: FormState = { error: null };

export function InviteForm({ courseId }: { courseId: string }) {
  const [state, action, pending] = useActionState(inviteMember, initialState);

  return (
    <form action={action} className="card mt-4 flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">Invite a member</h2>
      <input type="hidden" name="course_id" value={courseId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm text-muted">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-muted">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="role" className="text-sm text-muted">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue="trainee"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        >
          <option value="trainee">Trainee</option>
          <option value="trainer">Trainer</option>
        </select>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 font-medium text-card disabled:opacity-60"
      >
        {pending ? "Sending invite..." : "Send invite"}
      </button>
    </form>
  );
}
