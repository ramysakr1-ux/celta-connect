"use client";

import { useOptimistic, useTransition } from "react";
import { cycleCapabilityOverride } from "@/app/centre/owner/actions";

const LEVEL_STYLE: Record<string, React.CSSProperties | undefined> = {
  full: { background: "oklch(45% 0.09 155)", color: "white", borderColor: "oklch(45% 0.09 155)" },
  view: { background: "oklch(60% 0.11 70)", color: "white", borderColor: "oklch(60% 0.11 70)" },
  none: undefined,
};
const LEVEL_TEXT: Record<string, string> = { full: "Full", view: "View", none: "None" };
const ORDER = ["full", "view", "none"] as const;

// One pill, flipping the moment it is clicked.
//
// It was a plain form posting a server action, and the note on the customizer
// explains why: client state risked drifting from the live preview text
// below the table, which is generated server-side from the same grantFor()
// the table reads. That guarantee is worth keeping.
//
// But it made every click cost a full round trip and a re-render before
// anything moved -- about a second each, on a screen whose whole point is
// mixing and matching a dozen cells. Ramy, 30 Aug 2026: "is there any way we
// can make those centre owner role creating chips go a bit faster?"
//
// So the pill is optimistic and nothing else is. The label changes at once;
// the write still goes through the same server action, and the preview text
// still comes from the server. The two can disagree for the few hundred
// milliseconds between click and revalidation -- during a deliberate edit,
// on a value the user just chose themselves -- and they cannot disagree
// after it, because the server remains the only thing that decides what the
// preview says.
//
// If the write fails, React discards the optimistic value and the pill snaps
// back to what the server actually holds. That is the correct outcome and it
// needs no error handling of its own.
export function CapabilityPill({
  roleKey,
  capabilityKey,
  level,
}: {
  roleKey: string;
  capabilityKey: string;
  level: string;
}) {
  const [shown, setShown] = useOptimistic(level);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      className="cap-btn"
      style={LEVEL_STYLE[shown]}
      aria-label={`${capabilityKey} for ${roleKey}: ${LEVEL_TEXT[shown]}. Click to cycle.`}
      onClick={() => {
        const next = ORDER[(ORDER.indexOf(shown as (typeof ORDER)[number]) + 1) % ORDER.length];
        startTransition(async () => {
          setShown(next);
          const fd = new FormData();
          fd.set("role_key", roleKey);
          fd.set("capability_key", capabilityKey);
          fd.set("current_level", shown);
          await cycleCapabilityOverride(fd);
        });
      }}
    >
      {LEVEL_TEXT[shown]}
    </button>
  );
}
