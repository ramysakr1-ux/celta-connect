"use client";

import { useEffect } from "react";

// §1.1a v2 rule 8 -- the page opens scrolled to today, not Week 1.
export function ScrollToToday() {
  useEffect(() => {
    document.querySelector("[data-today]")?.scrollIntoView({ block: "center" });
  }, []);
  return null;
}
