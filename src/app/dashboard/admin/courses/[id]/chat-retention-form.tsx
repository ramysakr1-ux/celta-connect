"use client";

import { useState } from "react";
import { updateChatRetentionDays } from "@/app/dashboard/admin/courses/[id]/roster-actions";

// Moved from Centre Admin (migration 0154, per Ramy 2026-08-18: "chat
// retention lives in Course Admin, configured by the MCT per course") --
// same preset UI as before, just targeting this course instead of the
// whole centre.
//
// build-spec.md's "Chat retention is a centre setting": three positions,
// not two -- "Retain for the course" (migration 0174's chat_retention_mode)
// has no day count at all, cleared at close-out instead of on a rolling
// window. "A centre choosing retention should be told that plainly at the
// point of choosing" -- the warning below only shows once a retaining
// option is actually picked, not by default.
export function ChatRetentionForm({
  courseId,
  chatRetentionDays,
  chatRetentionMode,
}: {
  courseId: string;
  chatRetentionDays: number;
  chatRetentionMode: "days" | "course";
}) {
  type Preset = "nightly" | "weekly" | "monthly" | "custom" | "course";
  const initialPreset: Preset =
    chatRetentionMode === "course"
      ? "course"
      : chatRetentionDays === 1
        ? "nightly"
        : chatRetentionDays === 7
          ? "weekly"
          : chatRetentionDays === 30
            ? "monthly"
            : "custom";
  const [retentionPreset, setRetentionPreset] = useState<Preset>(initialPreset);
  const [customDays, setCustomDays] = useState(chatRetentionDays);
  const effectiveDays =
    retentionPreset === "nightly"
      ? 1
      : retentionPreset === "weekly"
        ? 7
        : retentionPreset === "monthly"
          ? 30
          : retentionPreset === "custom"
            ? customDays
            : chatRetentionDays;

  return (
    <form action={updateChatRetentionDays} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="course_id" value={courseId} />
        <input type="hidden" name="chat_retention_mode" value={retentionPreset === "course" ? "course" : "days"} />
        <select
          name="chat_retention_preset_display"
          value={retentionPreset}
          onChange={(e) => setRetentionPreset(e.target.value as Preset)}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="nightly">Clear at midnight (default)</option>
          <option value="weekly">Retain for 7 days</option>
          <option value="monthly">Retain for 30 days</option>
          <option value="custom">Custom period</option>
          <option value="course">Retain for the course</option>
        </select>
        {retentionPreset === "custom" ? (
          <input
            type="number"
            min={1}
            value={customDays}
            onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
            className="w-20 rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        ) : null}
        <input type="hidden" name="chat_retention_days" value={effectiveDays} />
        <button type="submit" className="rounded-[6px] border border-border px-3 py-2 text-sm text-ink hover:border-primary">
          Save
        </button>
      </div>
      {retentionPreset !== "nightly" ? (
        <p className="max-w-md text-xs text-muted">
          Retained chat is discoverable in a complaint or an appeal -- that cuts both ways: it protects a tutor
          accused of something they did not say, and it exposes an off-hand remark.
          {retentionPreset === "course" ? " Cleared when this course closes out, along with everything else." : ""}
        </p>
      ) : null}
    </form>
  );
}
