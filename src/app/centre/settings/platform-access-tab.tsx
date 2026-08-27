"use client";

import { useActionState } from "react";
import { invitePlatformOwner, revokePlatformOwnerInvite, type PlatformAccessFormState } from "@/app/centre/settings/platform-access-actions";

const initial: PlatformAccessFormState = { error: null };

export interface PlatformAccessRow {
  id: string;
  invitedAt: string;
  note: string | null;
  status: "active" | "revoked";
}

export interface AccessLogRow {
  id: string;
  accessedAt: string;
  page: string;
}

// for-claude-code-command-center.md's access model, disclosed here: this
// centre's own view of whether Connect's platform owner has standing access,
// and the real, permanent log of every time he's actually used it -- "they
// should see in their own activity log that Ramy accessed their centre. No
// silent/backdoor viewing."
export function PlatformAccessTab({ invite, accessLog }: { invite: PlatformAccessRow | null; accessLog: AccessLogRow[] }) {
  const [state, action, pending] = useActionState(invitePlatformOwner, initial);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif text-lg text-ink">Connect access</h2>
        <p className="mt-1 text-sm text-muted">
          Connect&apos;s platform owner has no standing access to your centre&apos;s data unless you invite them in. If you do, every visit is
          logged here, permanently.
        </p>
      </div>

      {invite ? (
        <div className="sheet flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Standing access granted</p>
            <p className="mt-1 text-xs text-muted">
              Since {new Date(invite.invitedAt).toLocaleDateString()}
              {invite.note ? ` — ${invite.note}` : ""}
            </p>
          </div>
          <form action={revokePlatformOwnerInvite}>
            <input type="hidden" name="invite_id" value={invite.id} />
            <button type="submit" className="shrink-0 text-xs text-destructive hover:underline">
              Revoke
            </button>
          </form>
        </div>
      ) : (
        <div className="sheet">
          <h3 className="font-serif text-base text-ink">Invite Connect in</h3>
          <p className="mt-1 text-sm text-muted">Standing, not time-limited — revoke it any time from this same screen.</p>
          <form action={action} className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="note" className="text-sm text-muted">
                Note (optional)
              </label>
              <textarea
                id="note"
                name="note"
                rows={2}
                placeholder="What you'd like help with"
                className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              />
            </div>
            {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send invite"}
            </button>
          </form>
        </div>
      )}

      <div>
        <h3 className="font-serif text-base text-ink">Access log</h3>
        <p className="mt-1 text-sm text-muted">Every real visit, whenever standing access has existed.</p>
        <div className="sheet mt-3 overflow-hidden !p-0">
          {accessLog.length === 0 ? (
            <p className="p-6 text-sm text-muted">No visits recorded.</p>
          ) : (
            <ul>
              {accessLog.map((a) => (
                <li key={a.id} className="list-row flex items-center justify-between gap-4">
                  <span className="text-sm text-ink">Opened {a.page}</span>
                  <span className="text-xs text-muted">{new Date(a.accessedAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
