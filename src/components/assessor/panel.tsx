import Link from "next/link";
import { AMBER, BORDER, GOLD, INK, MUTED, TEAL } from "@/components/assessor/tokens";

// for-claude-code-assessor-pack-complete.md B2: panel accents here were
// decorative, not semantic -- the requirements panel was gold, centre
// documents garnet, cohort documents the default teal. Garnet belongs to the
// MCT's room and says nothing in a pack whose identity is ink-warm and gold,
// so it is gone: a panel takes gold or a hairline.
//
// And B1: a document is not a status. The edges left in this pack all mean
// one of two things now -- amber, the assessor needs to look at this; teal,
// it is complete -- so the panels holding documents carry no colour at all.
export function Panel({
  title,
  children,
  accent = "none",
}: {
  title: string;
  children: React.ReactNode;
  accent?: "gold" | "none";
}) {
  return (
    <div>
      <p
        style={{
          fontSize: "var(--text-label)", fontWeight: 700, letterSpacing: "0.08em",
          textTransform: "uppercase", color: MUTED, marginBottom: 8,
        }}
      >
        {title}
      </p>
      <div
        className="card overflow-hidden"
        style={{ borderTop: accent === "gold" ? `3px solid ${GOLD}` : `1px solid ${BORDER}` }}
      >
        {children}
      </div>
    </div>
  );
}

// Ramy, 30 Aug 2026: "can we have a hovering effect on the centre documents
// as well?"
//
// Worth saying what was actually wrong, because it was more than a missing
// ring: every one of these rows already carried the hover ring, so the whole
// row lit up on hover -- but only the small "Open" anchor was clickable.
// The hover was writing a cheque the row could not cash, and on a read-only
// screen an assessor has no way to discover that except by clicking and
// having nothing happen. The row is the link now, so the ring means what it
// looks like it means.
export function DocRow({ label, href, status }: { label: string; href: string; status: string }) {
  return (
    <Link
      href={href}
      className="lift hover-ring no-underline"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        padding: "11px 15px", borderBottom: `1px solid color-mix(in srgb, ${BORDER} 45%, transparent)`,
      }}
    >
      <span>
        <span style={{ fontSize: "var(--text-meta)", fontWeight: 600, color: INK, display: "block" }}>{label}</span>
        <span style={{ fontSize: "var(--text-micro)", color: TEAL }}>{status}</span>
      </span>
      <span style={{ fontSize: "var(--text-label)", fontWeight: 600, color: TEAL, flex: "none" }}>Open</span>
    </Link>
  );
}

/** A met/not-met dot: teal when it is done, amber when it still needs looking at. */
export function Dot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: ok ? TEAL : AMBER }} />
      <span style={{ fontSize: "var(--text-micro)", color: MUTED }}>{label}</span>
    </span>
  );
}
