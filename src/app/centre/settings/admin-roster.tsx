"use client";

import { useState } from "react";
import { CreateInviteForm, RevokeInviteButton, GrantRoleForm, RevokeRoleButton } from "@/app/centre/roles/role-forms";
import { CENTRE_ROLE_LABELS, type CentreRole } from "@/lib/auth/centre-permissions";
import Link from "next/link";

export interface RosterRow {
  grantId: string;
  name: string;
  email: string;
  role: CentreRole;
  scope: string;
}

const ROLE_PILL_CLASS: Record<CentreRole, string> = {
  centre_owner: "bg-destructive/10 text-destructive border-destructive/30",
  centre_administrator: "bg-primary/10 text-primary border-primary/30",
  course_administrator: "bg-surface-muted text-muted border-border",
  centre_manager: "bg-surface-muted text-muted border-border",
};

// for-claude-code-centre-settings.md, "3. Admin roster": "this screen only
// shows who currently holds what, not what each role can do" -- the full
// permission breakdown stays on Centre Admin's Roles tab, linked from the
// footer note. Reuses the same grant/revoke/invite forms Roles already
// has (role-forms.tsx) rather than a second copy of that logic.
export function AdminRoster({ rows, invites, mayAppoint }: { rows: RosterRow[]; invites: { id: string; role: CentreRole; created_at: string }[]; mayAppoint: boolean }) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">{rows.length} people have centre-level access.</p>
        {mayAppoint ? (
          <button
            type="button"
            onClick={() => setShowInvite((v) => !v)}
            className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Invite someone
          </button>
        ) : null}
      </div>

      {mayAppoint && showInvite ? (
        <div className="flex flex-col gap-4 rounded-[10px] border border-border bg-card px-[22px] py-5">
          <div>
            <h3 className="font-serif text-sm text-ink">Appoint someone with an account already</h3>
            <GrantRoleForm />
          </div>
          <div className="border-t border-border-faint pt-4">
            <h3 className="font-serif text-sm text-ink">Or send an invite link</h3>
            <CreateInviteForm />
          </div>
        </div>
      ) : null}

      <div className="rounded-[10px] border border-border bg-card">
        {rows.map((row, i) => (
          <div
            key={row.grantId}
            className={`flex items-center justify-between gap-4 px-5 py-3 ${i > 0 ? "border-t border-border-faint" : ""}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{row.name}</p>
              <p className="truncate text-xs text-muted">{row.email}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ROLE_PILL_CLASS[row.role]}`}>
              {CENTRE_ROLE_LABELS[row.role]}
            </span>
            <span className="w-32 shrink-0 truncate text-right text-xs text-muted">{row.scope}</span>
            <span className="w-16 shrink-0 text-right">
              {row.role === "centre_owner" ? null : mayAppoint ? <RevokeRoleButton grantId={row.grantId} /> : null}
            </span>
          </div>
        ))}
      </div>

      {invites.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Pending invites</p>
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border-faint px-3 py-2">
              <span className="text-sm text-ink">{CENTRE_ROLE_LABELS[inv.role]}</span>
              <span className="text-xs text-muted">{new Date(inv.created_at).toLocaleDateString()}</span>
              <RevokeInviteButton inviteId={inv.id} />
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted">
        Nobody chooses their own role — the invitation carries it.{" "}
        <Link href="/centre/roles" className="text-primary hover:underline">
          See the full permission breakdown per role →
        </Link>
      </p>
    </div>
  );
}
