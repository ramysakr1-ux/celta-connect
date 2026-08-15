"use client";

import { useState } from "react";
import { MessageThread } from "@/app/dashboard/staff-chat/message-thread";
import type { AdminChatCourse } from "@/lib/admin-chat";

// "Administrators can chat with each other, keyed by course, not by
// person -- an admin thinks 'tell C2's tutors' [about something], not
// 'message Nadia.'" Deliberately NOT built on StaffChatDrawer -- that
// component's picker is person/DM-shaped and its channel labels are
// resolved for a TRAINER's view. This is a separate, simpler bar: pick a
// course, see/send messages with whichever other admins are also on this
// centre. No trainer is ever reachable here, and no admin is ever
// reachable from the trainer-only staff chat -- see migration 0092.
export function AdminChatBar({ profileId, courses }: { profileId: string; courses: AdminChatCourse[] }) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(courses[0]?.courseId ?? null);
  const [open, setOpen] = useState(false);

  if (courses.length === 0) return null;
  const selected = courses.find((c) => c.courseId === selectedCourseId) ?? courses[0];
  const nameById = new Map<string, string>();

  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2">
      {open ? (
        <div className="w-full max-w-md rounded-[16px] border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <select
              value={selected.courseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="h-8 flex-1 rounded-[6px] border border-input bg-card px-2 text-sm text-ink"
            >
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.courseName}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">
              Close
            </button>
          </div>
          <MessageThread key={selected.channelId} channelId={selected.channelId} myProfileId={profileId} nameById={nameById} isGroup />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-ink shadow-lg hover:border-primary"
        >
          Admin chat -- {selected.courseName}
        </button>
      )}
    </div>
  );
}
