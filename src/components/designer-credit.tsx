import { Wordmark } from "@/components/wordmark";

// specs/rename-to-connect.md: "[mark, 20px] Connect · designed and built by
// Ramy" -- the public landing page footer only (src/app/page.tsx), never on
// an internal working screen or an exported/Cambridge-facing document. It's
// a brand mark, not a functional element, so it doesn't belong on every
// dashboard/entry-gate footer -- moved off Centre Admin + sign-in 2026-08-15.
// Not gold -- gold would make the credit the brightest thing on the page.
export function DesignerCredit() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <Wordmark size="icon" iconSizePx={20} />
      <span>
        Connect &middot; designed and built by <span className="text-ink">Ramy</span>
      </span>
    </span>
  );
}
