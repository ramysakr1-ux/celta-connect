"use client";

import { useEffect, useRef, useState } from "react";

const DARK_ITEM = "oklch(0.2 0.014 60)";
const CARD = "oklch(0.992 0.005 90)";
const INK = "oklch(0.235 0.017 65)";
const MUTED = "oklch(0.51 0.017 70)";
const HOVER = "oklch(0.96 0.012 82)";

const PRODUCTS = [
  { name: "Connect Hub", href: "https://ramysakr1-ux.github.io/connect-Hub/", color: "oklch(0.45 0.15 27)", initial: "H" },
  { name: "Connect", href: "/app", color: "oklch(0.38 0.072 195)", initial: "C" },
  { name: "Affina", href: "https://app.affina.com.tr", color: "oklch(0.5 0.11 155)", initial: "A" },
] as const;

// command-center-full-spec.md: "Extensible for future projects." Connect's
// own row links to /app -- a placeholder, since Command Center itself lives
// under /platform, not a dedicated /app; kept as the literal spec target
// rather than guessing a real destination that isn't built.
export function ProductSwitcher() {
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
        style={{ width: 34, height: 34, borderRadius: 6, background: DARK_ITEM, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="oklch(78% 0.02 80)">
          {[5, 12, 19].flatMap((cy) => [5, 12, 19].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" />))}
        </svg>
      </div>
      {open ? (
        <div style={{ position: "absolute", top: 42, right: 0, width: 210, background: CARD, borderRadius: 8, boxShadow: "0 4px 20px -4px rgba(0,0,0,0.35)", overflow: "hidden", zIndex: 30 }}>
          <div style={{ padding: "8px 14px", background: HOVER, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>Your products</div>
          {PRODUCTS.map((p) => (
            <a
              key={p.name}
              href={p.href}
              target={p.href.startsWith("http") ? "_blank" : undefined}
              rel={p.href.startsWith("http") ? "noreferrer" : undefined}
              className="admin-hover-fill"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", textDecoration: "none" }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 6, background: p.color, color: CARD, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                {p.initial}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{p.name}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
