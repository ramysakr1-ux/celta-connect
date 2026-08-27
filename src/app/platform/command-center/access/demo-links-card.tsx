"use client";

import { useActionState, useState, useTransition } from "react";
import { generateDemoLoginLink, revokeDemoLoginLink, type GenerateLinkState } from "@/app/platform/command-center/access/actions";
import type { DemoLoginRoleKey } from "@/app/platform/command-center/access/role-keys";

const CARD = "oklch(0.992 0.005 90)";
const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";
const BORDER = "oklch(0.895 0.012 82)";
const SAND = "oklch(0.935 0.012 82)";
const GOLD = "oklch(0.62 0.14 68)";
const DARK = "oklch(0.14 0.012 60)";
const TEAL = "oklch(0.38 0.072 195)";
const RED = "oklch(0.58 0.16 25)";

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
const selectStyle: React.CSSProperties = { flex: 1, height: 32, borderRadius: 6, border: "1px solid oklch(0.85 0.014 82)", background: CARD, fontSize: 12, color: INK, padding: "0 8px" };

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
    <div style={{ background: CARD, borderRadius: 10, boxShadow: "rgba(30,20,10,0.04) 0 1px 2px", padding: 20, display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "Newsreader, serif", fontSize: 17, fontWeight: 600, color: INK }}>Demo login links</div>
        <div style={{ fontSize: 11, color: "oklch(0.58 0.017 70)" }}>24h expiry</div>
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
        Sign in as any role on any centre for a demo — each link is single-purpose and expires automatically. Not the same as Owner/Invited access; generating one here is always logged.
      </div>

      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, borderRadius: 8, background: SAND }}>
        <div style={{ display: "flex", gap: 8 }}>
          <select name="center_id" required defaultValue="" style={selectStyle}>
            <option value="" disabled>
              Pick a centre
            </option>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="role_key" required defaultValue="" style={selectStyle}>
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
          className="admin-hover-fill"
          style={{ height: 32, borderRadius: 6, background: GOLD, color: DARK, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none", opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Generating…" : "Generate link"}
        </button>
        {state.error ? <p style={{ fontSize: 11.5, color: RED }}>{state.error}</p> : null}
      </form>

      {activeLinks.length === 0 ? (
        <p style={{ fontSize: 12.5, color: MUTED }}>No active demo links.</p>
      ) : (
        activeLinks.map((link) => (
          <div key={link.id} className="admin-hover" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>
                {ROLE_LABEL[link.roleKey as DemoLoginRoleKey] ?? link.roleKey} · {link.centreName}
              </div>
              <div style={{ fontSize: 11, color: "oklch(0.58 0.017 70)" }}>{hoursLeft(link.expiresAt)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
              <div onClick={() => handleCopy(link)} style={{ fontSize: 11, fontWeight: 600, color: TEAL, cursor: "pointer" }}>
                {copiedId === link.id ? "Copied" : "Copy"}
              </div>
              <div
                onClick={() =>
                  startRevoke(async () => {
                    await revokeDemoLoginLink(link.id);
                  })
                }
                style={{ fontSize: 11, fontWeight: 600, color: RED, cursor: revokingId ? "default" : "pointer", opacity: revokingId ? 0.6 : 1 }}
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
