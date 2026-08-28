"use client";

import { useEffect, useRef, useState } from "react";
import { savePreCourseTaskAnswer } from "@/app/portfolio/[traineeId]/pre-course-task/actions";

// Ramy, 28 Aug 2026: the pre-course task is answered in Connect, not on
// paper. Same debounced continuous-autosave shape the filmed-observation
// task response form already uses -- no submit button, because this task is
// explicitly never graded and never handed in, so there is nothing to
// submit TO. Read-only for staff/assessors viewing a candidate's answers.
export function TaskAnswerBox({
  itemId,
  initialResponse,
  readOnly,
}: {
  itemId: string;
  initialResponse: string;
  readOnly: boolean;
}) {
  const [value, setValue] = useState(initialResponse);
  const [saved, setSaved] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Skips the save that would otherwise fire from the initial mount, which
  // would write every untouched task back to the DB just for opening the page.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (readOnly || !dirtyRef.current) return;
    setSaved(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("response", value);
      void savePreCourseTaskAnswer(fd).then(() => setSaved(true));
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, itemId, readOnly]);

  if (readOnly) {
    return value.trim() ? (
      <p className="whitespace-pre-wrap rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink">{value}</p>
    ) : (
      <p className="rounded-[6px] border border-dashed border-border px-3 py-2 text-sm text-muted">Not answered yet.</p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <textarea
        value={value}
        onChange={(e) => {
          dirtyRef.current = true;
          setValue(e.target.value);
        }}
        rows={3}
        placeholder="Write your answer…"
        className="rounded-[6px] border border-border bg-card-inset px-3 py-2 text-sm text-ink outline-none focus:border-primary"
      />
      <span className="text-[11px] text-muted">{saved ? "Saved" : "Saving…"}</span>
    </div>
  );
}
