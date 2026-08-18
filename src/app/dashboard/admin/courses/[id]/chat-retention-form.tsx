"use client";

import { useState } from "react";
import { updateChatRetentionDays } from "@/app/dashboard/admin/courses/[id]/roster-actions";

// Moved from Centre Admin (migration 0154, per Ramy 2026-08-18: "chat
// retention lives in Course Admin, configured by the MCT per course") --
// same preset UI as before, just targeting this course instead of the
// whole centre.
export function ChatRetentionForm({ courseId, chatRetentionDays }: { courseId: string; chatRetentionDays: number }) {
  const initialPreset = chatRetentionDays === 1 ? "nightly" : chatRetentionDays === 7 ? "weekly" : "custom";
  const [retentionPreset, setRetentionPreset] = useState<"nightly" | "weekly" | "custom">(initialPreset);
  const [customDays, setCustomDays] = useState(chatRetentionDays);
  const effectiveDays = retentionPreset === "nightly" ? 1 : retentionPreset === "weekly" ? 7 : customDays;

  return (
    <form action={updateChatRetentionDays} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      <select
        name="chat_retention_preset_display"
        value={retentionPreset}
        onChange={(e) => setRetentionPreset(e.target.value as "nightly" | "weekly" | "custom")}
        className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      >
        <option value="nightly">Nightly (1 day)</option>
        <option value="weekly">Weekly (7 days)</option>
        <option value="custom">Custom</option>
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
    </form>
  );
}
