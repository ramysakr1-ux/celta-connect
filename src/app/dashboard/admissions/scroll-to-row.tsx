"use client";

import { useEffect } from "react";

// Brings a highlighted applicant row into view once, on mount. Used by the
// demo's ?stage= entry (for-claude-code-demo-clock.md §3): the story opens
// the Admissions room "with the seeded applicant at a given stage", and a
// row half a screen down is not opened with until it is in front of you.
export function ScrollToRow({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [id]);
  return null;
}
