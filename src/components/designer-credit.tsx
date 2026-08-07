import { Wordmark } from "@/components/wordmark";

// specs/rename-to-connect.md: "[mark, 20px] Connect · designed and built by
// Ramy" -- exactly two places only (Centre Admin footer, sign-in page
// footer), never on an exported or Cambridge-facing document. Not gold --
// gold would make the credit the brightest thing on the page.
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
