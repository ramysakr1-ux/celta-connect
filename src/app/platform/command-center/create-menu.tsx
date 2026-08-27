"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const DARK = "oklch(0.14 0.012 60)";
const GOLD = "oklch(0.62 0.14 68)";
const CARD = "oklch(0.992 0.005 90)";
const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";
const BORDER = "oklch(0.895 0.012 82)";

// command-center-full-spec.md's own "known gaps": only Create a course has
// a real destination today. The other six stay visible (so the menu isn't
// a lie about what's coming) but inert -- muted, not clickable -- rather
// than linking somewhere that doesn't exist yet.
const ACTIONS = [
  { label: "Add a centre", href: "/platform" },
  { label: "Create a course", href: "/dashboard/admin/courses/new" },
  { label: "Invite a trainer/tutor", href: null },
  { label: "Invite an assessor", href: null },
  { label: "Create a support reply/ticket", href: null },
  { label: "Add a platform announcement", href: null },
  { label: "Add a role/permission", href: null },
] as const;

export function CreateMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((v) => !v)}
        className="admin-hover-fill"
        style={{ height: 34, padding: "0 15px", borderRadius: 6, background: GOLD, color: DARK, fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create
      </div>
      {open ? (
        <div style={{ position: "absolute", top: 42, right: 0, width: 240, background: CARD, borderRadius: 8, boxShadow: "0 4px 20px -4px rgba(0,0,0,0.35)", overflow: "hidden", zIndex: 30 }}>
          {ACTIONS.map((a, i) =>
            a.href ? (
              <Link
                key={a.label}
                href={a.href}
                onClick={() => setOpen(false)}
                className="admin-hover-fill"
                style={{
                  display: "block", padding: "11px 14px", fontSize: 12.5, fontWeight: 500, color: INK, textDecoration: "none",
                  borderBottom: i < ACTIONS.length - 1 ? `1px solid ${BORDER}` : "none",
                }}
              >
                {a.label}
              </Link>
            ) : (
              <div
                key={a.label}
                title="Not built yet"
                style={{
                  padding: "11px 14px", fontSize: 12.5, fontWeight: 500, color: MUTED, cursor: "not-allowed",
                  borderBottom: i < ACTIONS.length - 1 ? `1px solid ${BORDER}` : "none",
                }}
              >
                {a.label}
              </div>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
