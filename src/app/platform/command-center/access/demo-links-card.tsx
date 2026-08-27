"use client";

import { useActionState, useState, useTransition } from "react";
import { generateDemoLoginLink, revokeDemoLoginLink, type GenerateLinkState } from "@/app/platform/command-center/access/actions";
import type { DemoLoginRoleKey } from "@/app/platform/command-center/access/role-keys";

export interface ActiveLinkRow {
  id: string;
  centreName: string;
  roleKey: string;
  loginToken: string;
  expiresAt: string;
}

const ROLE_LABEL: Record<DemoLoginRoleKey, string> = {
  mct: "MCT (trainer)",
  act: "ACT (trainer)",
  trainee: "Trainee",
  assessor: "Assessor",
  volunteer: "Volunteer",
  centre_admin: "Centre Owner/Admin",
};

function hoursLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const hrs = Math.round(ms / 3_600_000);
  return hrs <= 0 ? "Expires soon" : `Expires in ${hrs}h`;
}

const initialState: GenerateLinkState = { error: null };
// Nested one level inside the .card below -- bg-card, not bg-card-inset, per
// the universal layering rule ("frame -> card -> innermost element" goes
// light again at the innermost level, same as the form wrapper itself going
// to bg-card-inset one level up).
const selectClass = "h-8 flex-1 rounded-[6px] border border-input bg-card px-2 text-xs text-ink outline-none focus:border-primary";

// Migrated onto the shared .card design system 27 Aug 2026 -- was hand-built
// inline styles (CARD/GOLD/TEAL/RED literals) copied straight from
// command-center-visual-reference.html. "Generate link" is a plain CTA (no
// real status meaning), so it now uses the ordinary bg-primary button
// convention (src/app/platform/accounts/accounts-forms.tsx's "Save
// subscription") instead of a one-off gold fill.
export function DemoLinksCard({ centres, activeLinks }: { centres: { id: string; name: string }[]; activeLinks: ActiveLinkRow[] }) {
  const [state, formAction, pending] = useActionState(generateDemoLoginLink, initialState);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokingId, startRevoke] = useTransition();

  function handleCopy(link: ActiveLinkRow) {
    const url = `${window.location.origin}/platform/command-center/demo-login/${link.loginToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  return (
    <div className="card flex max-w-[720px] flex-col gap-3.5 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg text-ink">Demo login links</h2>
        <div className="text-[11px] text-muted">24h expiry</div>
      </div>
      <div className="text-[11.5px] leading-normal text-muted">
        Sign in as any role on any centre for a demo — each link is single-purpose and expires automatically. Not the same as Owner/Invited access;
        generating one here is always logged.
      </div>

      <form action={formAction} className="flex flex-col gap-2 rounded-[6px] bg-card-inset p-3.5">
        <div className="flex gap-2">
          <select name="center_id" required defaultValue="" className={selectClass}>
            <option value="" disabled>
              Pick a centre
            </option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="role_key" required defaultValue="" className={selectClass}>
            <option value="" disabled>
              Pick a role
            </option>
            {(Object.keys(ROLE_LABEL) as DemoLoginRoleKey[]).map((k) => (
              <option key={k} value={k}>
                {ROLE_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="flex h-8 items-center justify-center rounded-[6px] bg-primary text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
        >
          {pending ? "Generating…" : "Generate link"}
        </button>
        {state.error ? <p className="text-[11.5px] text-destructive">{state.error}</p> : null}
      </form>

      {activeLinks.length === 0 ? (
        <p className="text-[12.5px] text-muted">No active demo links.</p>
      ) : (
        activeLinks.map((link) => (
          <div key={link.id} className="admin-hover flex items-center justify-between gap-2.5 border-t border-border py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="text-[12.5px] font-semibold text-ink">
                {ROLE_LABEL[link.roleKey as DemoLoginRoleKey] ?? link.roleKey} · {link.centreName}
              </div>
              <div className="text-[11px] text-muted">{hoursLeft(link.expiresAt)}</div>
            </div>
            <div className="flex shrink-0 gap-2">
              <div
                onClick={() => handleCopy(link)}
                className="admin-hover-fill cursor-pointer rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold text-primary"
              >
                {copiedId === link.id ? "Copied" : "Copy"}
              </div>
              <div
                onClick={() =>
                  startRevoke(async () => {
                    await revokeDemoLoginLink(link.id);
                  })
                }
                className={`admin-hover-fill rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold text-destructive ${
                  revokingId ? "cursor-default opacity-60" : "cursor-pointer"
                }`}
              >
                Revoke
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
