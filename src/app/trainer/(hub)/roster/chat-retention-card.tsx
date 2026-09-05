"use client";

import { useState } from "react";
import { updateChatRetentionDays } from "@/app/dashboard/admin/courses/[id]/roster-actions";

// Chat retention is configured by the MCT per course (migration 0154).
// design_handoff_trainer_roster, "Chat retention card": two radios --
// keep for N days, or keep until the course closes (migration 0174's
// chat_retention_mode) -- and a Save button. The old nightly / weekly /
// monthly presets are the same setting: they were 1, 7 and 30 in the box.
//
// build-spec.md: "A centre choosing retention should be told that plainly
// at the point of choosing" -- the warning shows once a retaining option
// is picked, not by default.
export function ChatRetentionCard({
  courseId,
  chatRetentionDays,
  chatRetentionMode,
}: {
  courseId: string;
  chatRetentionDays: number;
  chatRetentionMode: "days" | "course";
}) {
  const [mode, setMode] = useState<"days" | "course">(chatRetentionMode);
  const [days, setDays] = useState(Math.max(1, chatRetentionDays));
  const retaining = mode === "course" || days > 1;

  return (
    <form action={updateChatRetentionDays} className="sheet flex flex-col gap-3 px-6 py-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink-warm">Chat retention</h2>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="chat_retention_mode" value={mode} />
      <input type="hidden" name="chat_retention_days" value={days} />
      <div className="flex flex-col gap-2 text-[13px]">
        <label className={`flex cursor-pointer items-center gap-2.5 ${mode === "days" ? "text-ink" : "text-muted"}`}>
          <input
            type="radio"
            name="retention_choice"
            checked={mode === "days"}
            onChange={() => setMode("days")}
            className="size-4"
            style={{ accentColor: "var(--hub-accent)" }}
          />
          <span>Keep messages for</span>
          <input
            type="number"
            min={1}
            value={days}
            onFocus={() => setMode("days")}
            onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
            aria-label="Days to keep messages"
            className="h-[30px] w-[54px] rounded-[6px] border border-border bg-card text-center text-[13px] text-ink tabular-nums outline-none focus:border-primary"
          />
          <span>{days === 1 ? "day" : "days"}</span>
        </label>
        <label className={`flex cursor-pointer items-center gap-2.5 ${mode === "course" ? "text-ink" : "text-muted"}`}>
          <input
            type="radio"
            name="retention_choice"
            checked={mode === "course"}
            onChange={() => setMode("course")}
            className="size-4"
            style={{ accentColor: "var(--hub-accent)" }}
          />
          <span>Keep until the course closes</span>
        </label>
      </div>
      {retaining ? (
        <p className="text-[11.5px] leading-[1.5] text-muted">
          Retained chat is discoverable in a complaint or an appeal -- that cuts both ways: it protects a tutor accused of
          something they did not say, and it exposes an off-hand remark.
          {mode === "course" ? " Cleared when this course closes out, along with everything else." : ""}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          className="trainer-hover-fill inline-flex h-8 items-center rounded-[8px] border border-border bg-card px-3.5 text-[12.5px] font-semibold text-ink"
        >
          Save
        </button>
      </div>
    </form>
  );
}
