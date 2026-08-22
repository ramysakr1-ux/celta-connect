"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  grantCentreRole,
  revokeCentreRole,
  assignArea,
  createCentreAdminInvite,
  revokeCentreAdminInvite,
  type GrantRoleState,
  type RevokeRoleState,
  type AssignAreaState,
  type CreateInviteState,
  type RevokeInviteState,
} from "@/app/centre/roles/actions";
import { AREAS, AREA_LABELS } from "@/lib/auth/areas";
import { CENTRE_ROLES, CENTRE_ROLE_LABELS } from "@/lib/auth/centre-permissions";

const grantInitial: GrantRoleState = {};
const revokeInitial: RevokeRoleState = {};
const createInviteInitial: CreateInviteState = {};
const revokeInviteInitial: RevokeInviteState = {};

export function CreateInviteForm() {
  const [state, action, pending] = useActionState(createCentreAdminInvite, createInviteInitial);
  const [copied, setCopied] = useState(false);

  const link = state.createdToken && typeof window !== "undefined" ? `${window.location.origin}/join-centre/${state.createdToken}` : null;

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
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
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Email (optional -- sends the invite for you)</span>
        <input
          name="email"
          type="email"
          placeholder="their.email@example.com"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Creating..." : "Create invite"}
      </button>
      {state.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
      {link ? (
        <div className="flex w-full flex-wrap items-center gap-2 rounded-[6px] border border-primary/30 bg-primary/5 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-xs text-ink">{link}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="shrink-0 text-xs font-semibold text-primary hover:underline"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(revokeCentreAdminInvite, revokeInviteInitial);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Withdraw this invite link? It will stop working.")) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="invite_id" value={inviteId} />
      <button type="submit" disabled={pending} className="text-xs text-muted hover:text-destructive disabled:opacity-60">
        {pending ? "Withdrawing..." : "Withdraw"}
      </button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
    </form>
  );
}

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

const assignInitial: AssignAreaState = {};

/**
 * §11: areas are assigned by the centre owner and never self-selected. The end
 * date makes it a temporary handover that lapses on its own, "so holiday cover
 * does not become a permanent reassignment nobody remembers to undo."
 */
export function AssignAreaForm() {
  const [state, action, pending] = useActionState(assignArea, assignInitial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Area</span>
        <select
          name="area"
          defaultValue="admissions"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        >
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {AREA_LABELS[a]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
        <span className="text-sm text-muted">Whose job it is</span>
        <input
          name="email"
          type="email"
          required
          placeholder="someone@centre.com"
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Until (optional)</span>
        <input
          name="ends_at"
          type="date"
          title="Leave blank for indefinite; a date makes this temporary cover that lapses on its own."
          className="h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? "Assigning..." : "Assign"}
      </button>
      {state.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
      {state.notice ? <p className="w-full text-sm text-primary">{state.notice}</p> : null}
    </form>
  );
}
