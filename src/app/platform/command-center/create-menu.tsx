"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const DARK = "oklch(0.14 0.012 60)";
const GOLD = "oklch(0.62 0.14 68)";
const CARD = "oklch(0.992 0.005 90)";
const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";
const BORDER = "oklch(0.895 0.012 82)";

// command-center-full-spec.md's own "known gaps". Add a role/permission was
// listed among them, but the screen it wants already exists: /centre/roles is
// where areas of responsibility are assigned and owner-defined custom roles
// are created. It was a real door standing shut, so it opens now. Centre-
// scoped, like Create a course above it.
//
// "Invite an assessor" is gone entirely, and not because it was unbuilt.
// Ramy, 3 Sep 2026: "why do we need to invite an assessor? Assessor only uses
// links for a certain period of time, and that's it." There is no assessor
// account to invite. The real link already exists and is issued by the course
// tutor from the trainer hub (getOrCreateAssessorToken), gated on assessor
// readiness and expiring with the course -- a course-level act by the person
// running the course, not something a platform owner creates from here. I
// briefly pointed this item at Access instead; that was wrong too, since
// "Access only creates magic links, not real invites."
//
// "Add a centre" is gone from here too. It pointed at /platform, the exact
// same destination as the green "+ Add a centre" pill on the Centres card --
// two doors to one room, and Ramy spotted it: "what's the difference?" One
// room, one door [[project_one_room_one_door]]. The pill stays, because it
// sits directly above the list it adds to; his call: "we can leave it there
// where the centre cards are."
//
// The three still without a href stay visible (so the menu isn't a lie about
// what's coming) but inert -- muted, not clickable -- rather than linking
// somewhere that doesn't exist yet.
const ACTIONS = [
  { label: "Create a course", href: "/centre/courses/new" },
  { label: "Invite a trainer/tutor", href: null },
  { label: "Create a support reply/ticket", href: null },
  { label: "Add a platform announcement", href: null },
  { label: "Add a role/permission", href: "/centre/roles" },
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
