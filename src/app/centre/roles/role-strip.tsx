"use client";

import { useState } from "react";
import {
  CENTRE_ROLES,
  CAPABILITY_LABELS,
  grantFor,
  roleLabel,
  describeRoleCapabilities,
  type Capability,
  type CentreRole,
  type OverrideMatrix,
} from "@/lib/auth/centre-permissions";

// The layout spec's role selector: one card-backed row of equal segments,
// each with a 3px coloured top spine, and a permission list below for
// whichever is selected. Selecting is a visual state, not a route change.
type Grant = "yes" | "read" | "no";

interface RoleStyle {
  who: string;
  tone: string; // text colour class
  spine: string; // top-spine background class
  band: string; // callout tint
  rule: string;
}

// Cosmetic-only per built-in role -- the copy that doesn't change with
// permissions (tone, "who this is for", the cross-cutting rule). Whether
// each capability actually reads yes/read/no is computed live below, from
// MATRIX + the centre owner's overrides, via for-claude-code-centre-owner-
// role-customizer.md's "the description shown on the Roles tab updates
// automatically" requirement -- this can never drift from the customizer,
// because it reads the exact same grantFor() the customizer writes to.
const STYLE: Record<CentreRole, RoleStyle> = {
  centre_administrator: {
    who: "runs admissions, payments and course setup",
    tone: "text-primary",
    spine: "bg-primary",
    band: "bg-primary/8 border-primary/25",
    rule: "A centre manager who is also a registered tutor on a course gets that course's chat and grading — as a tutor, on that course. The two roles never merge into one set of powers.",
  },
  centre_manager: {
    who: "wants the numbers, changes nothing",
    tone: "text-muted",
    spine: "bg-border",
    band: "bg-surface-muted border-border",
    rule: "The absence of an edit button everywhere is the whole design. A read-only role that hides its restrictions behind error messages is worse than no role at all — the buttons simply are not there.",
  },
  course_administrator: {
    who: "one or two courses, not the centre",
    tone: "text-muted",
    spine: "bg-border",
    band: "bg-surface-muted border-border",
    rule: "Scope is a list of courses, not a date range or a category. When somebody leaves, their courses are reassigned individually — which is deliberately a small chore, because it forces someone to notice what was theirs.",
  },
  centre_owner: {
    who: "the centre's own way back in",
    tone: "text-destructive",
    spine: "bg-destructive",
    band: "bg-destructive/8 border-destructive/25",
    rule: "The reach stops at the centre boundary. Nobody at Connect holds a key to a centre's courses, and there is no role above this one — a centre that hands over its grading needs to know the platform cannot quietly read it.",
  },
};

const CUSTOM_ROLE_STYLE: RoleStyle = {
  who: "a role your centre owner defined",
  tone: "text-ink",
  spine: "bg-ink",
  band: "bg-surface-muted border-border",
  rule: "Custom roles are defined and adjusted from the Centre Owner screen -- what shows here always matches exactly what was set there.",
};

function Mark({ grant }: { grant: Grant }) {
  if (grant === "yes") return <span className="text-primary">✓</span>;
  if (grant === "read") return <span className="text-muted">◑</span>;
  return <span className="text-muted">—</span>;
}

export function RoleStrip({
  holders,
  overrides,
  customRoles = [],
  customCapabilities = [],
}: {
  holders: Record<string, { id: string; name: string }[]>;
  overrides?: OverrideMatrix;
  customRoles?: { role_key: string; label: string }[];
  customCapabilities?: { capability_key: string; label: string }[];
}) {
  const allRoleKeys: string[] = [...CENTRE_ROLES, ...customRoles.map((r) => r.role_key)];
  const [selected, setSelected] = useState<string>("centre_administrator");

  const allCapabilities = [
    ...(Object.keys(CAPABILITY_LABELS) as Capability[]).map((key) => ({ key: key as string, label: CAPABILITY_LABELS[key] })),
    ...customCapabilities.map((c) => ({ key: c.capability_key, label: c.label })),
  ];

  const styleFor = (roleKey: string): RoleStyle => STYLE[roleKey as CentreRole] ?? CUSTOM_ROLE_STYLE;

  // A built-in role's one-liner is written prose -- "wants the numbers,
  // changes nothing" -- and cannot be generated. A custom role has no such
  // line, and "a role your centre owner defined" told the reader nothing
  // they could not see from the fact that it is in the list.
  //
  // Ramy, 30 Aug 2026, before demoing this: "if I create a new role as a
  // centre owner, that new role with the job description will appear in
  // centre management, right?" It appeared -- but only the placeholder did,
  // until you clicked through to the detail panel. The Centre Owner screen
  // promises "the description shown on the Roles tab updates automatically
  // to match whatever you set here", so the strip has to carry it too.
  //
  // Named capabilities, not a count: "sees payments and admissions" is a
  // job; "3 capabilities" is a number. Three at most, so a broadly-granted
  // role does not push the strip to three lines.
  const whoFor = (roleKey: string): string => {
    if (STYLE[roleKey as CentreRole]) return STYLE[roleKey as CentreRole].who;
    const full = allCapabilities
      .filter((c) => grantFor([roleKey], c.key, overrides) === true)
      .map((c) => c.label.toLowerCase());
    if (full.length === 0) return "no permissions set yet — set them in Centre owner";
    const shown = full.slice(0, 3);
    const rest = full.length - shown.length;
    return `can ${shown.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`;
  };
  const summaryFor = (roleKey: string) => describeRoleCapabilities(roleKey, overrides, customCapabilities);
  const permsFor = (roleKey: string) =>
    allCapabilities.map((cap) => {
      const g = grantFor([roleKey], cap.key, overrides);
      return { grant: (g === true ? "yes" : g === "read" ? "read" : "no") as Grant, text: cap.label };
    });

  const style = styleFor(selected);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 overflow-hidden rounded-[8px] border border-border bg-card lg:grid-cols-4">
        {allRoleKeys.map((role, i) => {
          const s = styleFor(role);
          const active = role === selected;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelected(role)}
              className={`relative px-5 py-4 text-left transition-colors duration-150 ${i < allRoleKeys.length - 1 ? "lg:border-r lg:border-border" : ""} ${
                active
                  ? "bg-[color-mix(in_oklab,var(--color-primary)_42%,var(--color-card))]"
                  : "bg-surface-muted/40 hover:bg-[color-mix(in_oklab,var(--color-primary)_30%,var(--color-card))] admin-hover-fill"
              }`}
            >
              <span className={`absolute inset-x-0 top-0 h-[3px] ${active ? s.spine : "bg-transparent"}`} aria-hidden="true" />
              <span className={`block text-[13.5px] font-bold ${s.tone}`}>{roleLabel(role, customRoles)}</span>
              <span className="mt-0.5 block text-xs text-muted">{whoFor(role)}</span>
              {(holders[role] ?? []).length > 0 ? (
                <span className="mt-1.5 block text-[11px] text-ink">
                  {(holders[role] ?? []).map((h) => h.name).join(", ")}
                </span>
              ) : (
                <span className="mt-1.5 block text-[11px] text-muted">Nobody yet</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="card px-5 py-4">
        <p className="text-sm text-ink">{summaryFor(selected)}</p>

        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {permsFor(selected).map((p) => (
            <div key={p.text} className="admin-hover flex items-start gap-2.5 rounded-[6px] bg-surface-muted/60 px-3 py-2">
              <span className="mt-px shrink-0 text-sm">
                <Mark grant={p.grant} />
              </span>
              <span className="flex flex-col">
                <span className="text-[13px] text-ink">{p.text}</span>
              </span>
            </div>
          ))}
        </div>

        <div className={`mt-4 rounded-[6px] border px-4 py-3 ${style.band}`}>
          <p className="text-xs leading-relaxed text-ink">{style.rule}</p>
        </div>
      </div>
    </div>
  );
}
