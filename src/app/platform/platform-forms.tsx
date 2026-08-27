"use client";

import { useState } from "react";
import { useActionState } from "react";
import {
  createCentreAndFirstAdmin,
  changeUserRole,
  type CreateCentreState,
  type ChangeRoleState,
} from "@/app/platform/actions";

const createCentreInitial: CreateCentreState = {};
const changeRoleInitial: ChangeRoleState = {};

export function CreateCentreForm() {
  const [state, action, pending] = useActionState(createCentreAndFirstAdmin, createCentreInitial);
  const [copied, setCopied] = useState(false);

  const link = state.createdToken && typeof window !== "undefined" ? `${window.location.origin}/join-centre/${state.createdToken}` : null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 min-w-[12rem] flex-col gap-1.5">
          <span className="text-sm text-muted">Centre name</span>
          <input
            name="name"
            required
            className="h-10 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-1 min-w-[10rem] flex-col gap-1.5">
          <span className="text-sm text-muted">Centre number</span>
          <input
            name="center_number"
            required
            placeholder="Cambridge-assigned"
            className="h-10 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-10 self-start rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 admin-hover-fill"
      >
        {pending ? "Creating..." : "Create centre + owner invite"}
      </button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {link ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs text-muted">{state.centerName} is ready. Send this to its first centre owner:</span>
          <code className="min-w-0 flex-1 truncate text-xs text-ink">{link}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="shrink-0 text-xs font-semibold text-primary hover:underline admin-hover-fill"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </form>
  );
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "trainee", label: "Trainee" },
  { value: "trainer", label: "Trainer" },
  { value: "admin", label: "Admin" },
  { value: "admissions", label: "Admissions" },
  { value: "platform_owner", label: "Platform owner" },
];

export function ChangeRoleForm() {
  const [state, action, pending] = useActionState(changeUserRole, changeRoleInitial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-1 min-w-[14rem] flex-col gap-1.5">
        <span className="text-sm text-muted">Email</span>
        <input
          type="email"
          name="email"
          required
          className="h-10 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">New role</span>
        <select
          name="role"
          defaultValue="admin"
          className="h-10 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink outline-none focus:border-primary"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60 admin-hover-fill"
      >
        {pending ? "Changing..." : "Change role"}
      </button>
      {state.error ? <p className="w-full text-sm text-destructive">{state.error}</p> : null}
      {state.notice ? <p className="w-full text-sm text-primary">{state.notice}</p> : null}
    </form>
  );
}
