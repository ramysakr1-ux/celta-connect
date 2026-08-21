"use client";

import { useEffect, useState } from "react";

// "A countdown to expiry is visible to support@ at all times." Client
// component since it ticks -- the server-rendered page around it doesn't
// need to.
export function CountdownBadge({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    function tick() {
      const msLeft = new Date(expiresAt).getTime() - Date.now();
      if (msLeft <= 0) {
        setLabel("Expired");
        return;
      }
      const hours = Math.floor(msLeft / 3_600_000);
      const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
      setLabel(hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`);
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <span className="shrink-0 rounded-full bg-status-warning-bg px-3 py-1.5 text-xs font-semibold text-status-warning-text">
      {label ?? "…"}
    </span>
  );
}
