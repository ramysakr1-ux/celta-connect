"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { markAdmissionsNotificationsRead } from "@/app/centre/actions";

// Ramy, 27 Aug 2026: "a different color light until someone clicks on it...
// doesn't have to be an audio" -- the ambient half of the admissions
// notification work (the other half, email + push, is
// notifyAdmissionsHandlers()). A live dot next to "Admissions pipeline" on
// the Centre Management overview, on for anyone with the page open when a
// new admissions_notifications row lands, off once someone clicks it.
// Shared across viewers (see markAdmissionsNotificationsRead), not
// per-person unread state.
export function AdmissionsChangeIndicator({ centerIds, initialUnread }: { centerIds: string[]; initialUnread: boolean }) {
  const [unread, setUnread] = useState(initialUnread);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (centerIds.length === 0) return;
    const myCenterIds = new Set(centerIds);
    const supabase = createClient();
    const channel = supabase
      .channel("admissions_notifications:change-watch")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admissions_notifications" }, (payload) => {
        const row = payload.new as { center_id: string };
        if (myCenterIds.has(row.center_id)) setUnread(true);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // centerIds is stable per page load (derived from the viewer's own
    // grants) -- re-subscribing on every render would drop/reopen the
    // socket for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!unread) return null;

  return (
    <button
      type="button"
      disabled={clearing}
      onClick={async () => {
        setClearing(true);
        setUnread(false);
        await Promise.all(centerIds.map((id) => markAdmissionsNotificationsRead(id)));
        setClearing(false);
      }}
      title="New admissions activity -- click to clear"
      aria-label="New admissions activity -- click to clear"
      className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive"
    />
  );
}
