"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

// Ramy, 25 Aug 2026: "I still have no way to sort of, like, go back" -- this
// page is one long scroll through both journeys with no anchor to jump back
// to. A plain fixed button, appears once you've actually scrolled somewhere.
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-30 flex size-11 items-center justify-center rounded-full border border-border bg-card text-ink shadow-lg hover:bg-accent/40"
    >
      <ArrowUp className="size-4" aria-hidden="true" />
    </button>
  );
}
