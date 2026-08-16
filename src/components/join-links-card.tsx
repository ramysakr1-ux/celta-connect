"use client";

import { useActionState, useState } from "react";
import {
  regenerateJoinLink,
  sendJoinLinkEmail,
  type EmailLinkState,
} from "@/app/dashboard/admin/courses/[id]/roster-actions";

const initialEmailState: EmailLinkState = { error: null, sent: false };

function EmailLinkForm({ courseId, role }: { courseId: string; role: "trainee" | "trainer" }) {
  const [state, action, pending] = useActionState(sendJoinLinkEmail, initialEmailState);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="role" value={role} />
      <input
        type="email"
        name="to_email"
        placeholder="Email this link to..."
        required
        className="flex-1 rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[6px] border border-border px-3 py-1.5 text-sm text-ink hover:border-primary disabled:opacity-60"
      >
        {pending ? "Sending..." : state.sent ? "Sent!" : "Send"}
      </button>
      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}

function LinkRow({
  label,
  link,
  courseId,
  role,
}: {
  label: string;
  link: string;
  courseId: string;
  role: "trainee" | "trainer";
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink">
          {link}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-[6px] border border-border px-3 py-2 text-sm text-ink hover:border-primary"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <form action={regenerateJoinLink}>
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="role" value={role} />
          <button type="submit" className="text-sm text-destructive underline">
            Regenerate
          </button>
        </form>
      </div>
      <EmailLinkForm courseId={courseId} role={role} />
    </div>
  );
}

export function JoinLinksCard({
  courseId,
  traineeLink,
  trainerLink,
}: {
  courseId: string;
  traineeLink: string;
  trainerLink: string;
}) {
  return (
    <div className="card flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Or share a general link</h2>
        <p className="mt-1 text-sm text-muted">
          Share these directly (text, WhatsApp, in person) -- whoever opens one sets up their own
          account instantly, no email required. Use these for a cohort of candidates; invite tutors
          by name above, so the role travels with the invitation. Regenerating a link invalidates
          the old one.
        </p>
      </div>
      <LinkRow label="Trainee join link" link={traineeLink} courseId={courseId} role="trainee" />
      <LinkRow label="Trainer join link" link={trainerLink} courseId={courseId} role="trainer" />
    </div>
  );
}
