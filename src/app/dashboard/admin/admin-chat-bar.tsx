"use client";

import { useState } from "react";
import { MessageThread } from "@/app/dashboard/staff-chat/message-thread";
import type { AdminChatRoom } from "@/lib/admin-chat";

// build-spec.md §12: the admin channel is "**Centre-scoped, not
// course-scoped.** Members: centre owner, centre admins, centre manager,
// course admins. No tutors, no candidates." Named after the centre, "so nobody
// assumes a message reaches tutors."
//
// This bar used to pick a COURSE, which §13 rejects from the other side too --
// an admin covering two cities "is having one conversation." It now picks a
// branch only when there is more than one, and otherwise shows the single room.
//
// Deliberately NOT built on StaffChatDrawer: that component's picker is
// person/DM-shaped and its labels are resolved for a TRAINER's view. No trainer
// is ever reachable here, and no admin is ever reachable from the trainer-only
// staff chat -- §10, "course chat is absent from every admin role, including
// centre owner. No exception, ever."
export function AdminChatBar({ profileId, rooms }: { profileId: string; rooms: AdminChatRoom[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(rooms[0]?.channelId ?? null);
  const [open, setOpen] = useState(false);

  if (rooms.length === 0) return null;
  const selected = rooms.find((r) => r.channelId === selectedId) ?? rooms[0];
  const nameById = new Map<string, string>();

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2">
      {open ? (
        <div className="w-full max-w-md rounded-[16px] border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            {/* Only a picker when there's more than one branch to pick. */}
            {rooms.length > 1 ? (
              <select
                value={selected.channelId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-8 flex-1 rounded-[6px] border border-input bg-card px-2 text-sm text-ink"
              >
                {rooms.map((r) => (
                  <option key={r.channelId} value={r.channelId}>
                    {r.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="flex-1 text-sm font-medium text-ink">{selected.name}</span>
            )}
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">
              Close
            </button>
          </div>
          <p className="mb-2 text-[11px] text-muted">
            Admins only — this reaches no tutor and no candidate. To reach a tutor, use their contact details on the
            roster.
            <span className="ml-1 font-semibold text-ink">Permanent — never resets.</span>
          </p>
          <MessageThread
            key={selected.channelId}
            channelId={selected.channelId}
            myProfileId={profileId}
            nameById={nameById}
            isGroup
            retentionDays={null}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-ink shadow-lg hover:border-primary"
        >
          {selected.name}
        </button>
      )}
    </div>
  );
}
