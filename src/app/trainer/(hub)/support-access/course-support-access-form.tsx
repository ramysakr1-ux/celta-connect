"use client";

import { useActionState } from "react";
import { grantCourseSupportAccess, revokeSupportGrant, type SupportGrantFormState } from "@/app/centre/settings/support-access-actions";
import type { SupportGrantRow } from "@/app/centre/settings/support-access-tab";

const initial: SupportGrantFormState = { error: null };

const STATUS_PILL: Record<SupportGrantRow["status"], string> = {
  active: "pill-success",
  expired: "pill-neutral",
  revoked: "pill-danger",
};
const STATUS_LABEL: Record<SupportGrantRow["status"], string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

export function CourseSupportAccessForm({ courseName, grants }: { courseName: string; grants: SupportGrantRow[] }) {
  const [state, action, pending] = useActionState(grantCourseSupportAccess, initial);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-2xl text-ink">Platform support access</h1>
        <p className="mt-1 text-sm text-muted">
          support@celtaconnect.com has no standing access to {courseName}. Access exists only as a time-boxed
          grant, scoped and logged. Course chat is never included unless you explicitly add it below.
        </p>
      </div>

      <div className="sheet">
        <h2 className="font-serif text-base text-ink">Grant access to {courseName}</h2>
        <p className="mt-1 text-sm text-muted">Grades, marking, and this course&apos;s timetable. Not course chat, unless you add it.</p>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reason" className="text-sm text-muted">
              Reason
            </label>
            <textarea
              id="reason"
              name="reason"
              required
              rows={2}
              placeholder="What support needs to see, and why"
              className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="duration_hours" className="text-sm text-muted">
              Duration
            </label>
            <select id="duration_hours" name="duration_hours" required className="h-9 w-40 rounded-[6px] border border-input bg-card px-2 text-sm text-ink">
              <option value="6">6 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="chat_included" className="size-4" />
            Also include course chat -- expect this to be rare
          </label>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <button type="submit" disabled={pending} className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {pending ? "Granting..." : "Grant access"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Access log for {courseName}</h2>
        <div className="sheet mt-3 overflow-hidden !p-0">
          {grants.length === 0 ? (
            <p className="p-6 text-sm text-muted">No grants have ever been made for this course.</p>
          ) : (
            <ul>
              {grants.map((g) => (
                <li key={g.id} className="list-row flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-ink">
                      Course access
                      {g.chatIncluded ? <span className="ml-2 text-xs text-gold">+ course chat</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{g.reason}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      Granted by {g.grantedByName} · {new Date(g.grantedAt).toLocaleString()} · {g.durationHours}h window
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`pill ${STATUS_PILL[g.status]}`}>{STATUS_LABEL[g.status]}</span>
                    {g.status === "active" ? (
                      <form action={revokeSupportGrant}>
                        <input type="hidden" name="grant_id" value={g.id} />
                        <button type="submit" className="text-xs text-destructive hover:underline">
                          Revoke
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
