"use client";

import { useActionState } from "react";
import {
  grantCentreRole,
  revokeCentreRole,
  type GrantRoleState,
  type RevokeRoleState,
} from "@/app/dashboard/centre/roles/actions";
import { CENTRE_ROLES, CENTRE_ROLE_LABELS } from "@/lib/auth/centre-permissions";

const grantInitial: GrantRoleState = {};
const revokeInitial: RevokeRoleState = {};

export function GrantRoleForm() {
  const [state, action, pending] = useActionState(grantCentreRole, grantInitial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
        <span className="text-sm text-muted">Their email</span>
        <input
          name="email"
          type="email"
          required
          placeholder="someone@centre.com"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Role</span>
        <select
          name="role"
          defaultValue="centre_administrator"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        >
          {CENTRE_ROLES.map((r) => (
            <option key={r} value={r}>
              {CENTRE_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Appointing..." : "Appoint"}
      </button>
      {state.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
      {state.granted ? <p className="w-full text-sm text-primary">{state.granted}</p> : null}
    </form>
  );
}

export function RevokeRoleButton({ grantId }: { grantId: string }) {
  const [state, action, pending] = useActionState(revokeCentreRole, revokeInitial);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Remove this role?")) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="grant_id" value={grantId} />
      <button type="submit" disabled={pending} className="text-xs text-muted hover:text-destructive disabled:opacity-60">
        {pending ? "Removing..." : "Remove"}
      </button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}
