"use client";

import { useActionState } from "react";
import { grantBillingSupportAccess, revokeSupportGrant, type SupportGrantFormState } from "@/app/centre/settings/support-access-actions";

const initial: SupportGrantFormState = { error: null };

export interface SupportGrantRow {
  id: string;
  scope: "course" | "billing";
  courseName: string | null;
  reason: string;
  grantedByName: string;
  grantedAt: string;
  durationHours: number;
  status: "active" | "expired" | "revoked";
  chatIncluded: boolean;
}

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

// for-claude-code-platform-support-access.md, "1a is the granter's screen
// (scope picker, reason, duration, access log)" -- design not in the repo,
// built against the .sheet/pill/list-row vocabulary already used
// throughout Centre Settings for visual consistency with the rest of the
// tab set.
export function SupportAccessTab({ canGrantBilling, grants }: { canGrantBilling: boolean; grants: SupportGrantRow[] }) {
  const [state, action, pending] = useActionState(grantBillingSupportAccess, initial);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif text-lg text-ink">Platform support access</h2>
        <p className="mt-1 text-sm text-muted">
          support@celtaconnect.com has no standing access to this centre&apos;s data. Access exists only as
          time-boxed grants, scoped to exactly what&apos;s needed and logged permanently, including grants declined
          or since revoked.
        </p>
      </div>

      {canGrantBilling ? (
        <div className="sheet">
          <h3 className="font-serif text-base text-ink">Grant billing access</h3>
          <p className="mt-1 text-sm text-muted">
            Fees, deposits, course setup -- no course content. For course-scoped access (grades, marking, that
            course&apos;s timetable), that course&apos;s main tutor grants it from their own screen.
          </p>
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
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <button type="submit" disabled={pending} className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {pending ? "Granting..." : "Grant access"}
            </button>
          </form>
        </div>
      ) : null}

      <div>
        <h3 className="font-serif text-base text-ink">Access log</h3>
        <p className="mt-1 text-sm text-muted">Every grant made for this centre, whoever made it.</p>
        <div className="sheet mt-3 overflow-hidden !p-0">
          {grants.length === 0 ? (
            <p className="p-6 text-sm text-muted">No grants have ever been made for this centre.</p>
          ) : (
            <ul>
              {grants.map((g) => (
                <li key={g.id} className="list-row flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-ink">
                      {g.scope === "course" ? `Course access -- ${g.courseName ?? "unknown course"}` : "Billing access"}
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
