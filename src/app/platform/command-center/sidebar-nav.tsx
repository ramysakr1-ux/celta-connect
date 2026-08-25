"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const INK_DARK = "oklch(0.14 0.012 60)";
const GOLD = "oklch(0.62 0.14 68)";
const INACTIVE_TEXT = "oklch(0.38 0.017 65)";
const INACTIVE_DOT = "oklch(0.7 0.02 75)";
const HOVER = "oklch(0.935 0.012 82)";

const SECTIONS = [
  { label: "Overview", href: "/platform/command-center" },
  { label: "People", href: "/platform/command-center/people" },
  { label: "Money", href: "/platform/command-center/money" },
  { label: "Access", href: "/platform/command-center/access" },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {SECTIONS.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 7,
              fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none",
              color: active ? INK_DARK : INACTIVE_TEXT,
              background: active ? GOLD : "transparent",
              transition: "background 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.background = HOVER;
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? INK_DARK : INACTIVE_DOT, flex: "0 0 auto" }} />
            {s.label}
          </Link>
        );
      })}
    </div>
  );
}
