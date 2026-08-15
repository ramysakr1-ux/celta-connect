"use client";

import { useActionState, useState } from "react";
import {
  sendJoinLinkEmail,
  type EmailLinkState,
} from "@/app/dashboard/admin/courses/[id]/roster-actions";

const initialState: EmailLinkState = { error: null, sent: false };

// for-claude-code-trainer-remaining-screens.md's Roster "Add candidate"
// action -- deliberately narrower than admin's JoinLinksCard: trainers can
// copy/send the existing trainee join link, but can't regenerate or remove
// it (that stays admin-only, since it invalidates the link for everyone
// who already has it). Real per-person invitation tracking ("10 of 12
// joined") is a separate, larger gap -- see [[project_course_admin_build]]
// -- deliberately not attempted here.
export function AddCandidateButton({ courseId, joinUrl }: { courseId: string; joinUrl: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState(sendJoinLinkEmail, initialState);

  async function handleCopy() {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
      >
        Add candidate
      </button>
    );
  }

  return (
    <div className="sheet flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Add a candidate</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">
          Close
        </button>
      </div>
      {joinUrl ? (
        <>
          <p className="text-xs text-muted">
            Share this link directly -- whoever opens it sets up their own account instantly.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-[6px] border border-border bg-card px-3 py-2 text-xs text-ink">
              {joinUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-[6px] border border-border px-3 py-2 text-xs text-ink hover:border-primary"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="role" value="trainee" />
            <input
              type="email"
              name="to_email"
              placeholder="Or email this link to..."
              required
              className="flex-1 rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded-[6px] border border-border px-3 py-1.5 text-xs text-ink hover:border-primary disabled:opacity-60"
            >
              {pending ? "Sending..." : state.sent ? "Sent!" : "Send"}
            </button>
          </form>
          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
        </>
      ) : (
        <p className="text-xs text-destructive">No join link set up for this course yet -- ask your centre admin.</p>
      )}
    </div>
  );
}
