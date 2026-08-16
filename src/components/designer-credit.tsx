import { Wordmark } from "@/components/wordmark";

// specs/rename-to-connect.md: "[mark, 20px] Connect · designed and built by
// Ramy". Not gold -- gold would make the credit the brightest thing on the
// page.
//
// History worth knowing before moving this again: on 2026-08-15 it was moved
// off the Centre Admin and sign-in footers onto the public landing page only
// (cf0bbba), and 32 minutes later the landing page itself was deleted when
// root started redirecting straight to sign-in (965286a) -- so the credit
// vanished as collateral, not by decision.
//
// Ramy, 2026-08-16: it belongs on every role's LANDING screen -- "when they
// land, they should know who built the damn thing." One per home screen:
// Centre Admin, Course Admin, trainer Today, trainee Course Stream, assessor,
// and the volunteer student view. Deliberately still NOT on internal working
// screens beyond those, and never on an exported or Cambridge-facing
// document.
export function DesignerCredit({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center pt-2 ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
        <Wordmark size="icon" iconSizePx={20} />
        <span>
          Connect &middot; designed and built by <span className="text-ink">Ramy</span>
        </span>
      </span>
    </div>
  );
}
