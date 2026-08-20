"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { switchActiveCourse } from "./switch-course-actions";

export interface SwitcherCourse {
  id: string;
  label: string;
  isPartTime: boolean;
}

// for-claude-code-course-switcher.md: "the active course code stays shown
// in the header badge at all times" and "click opens a panel listing 'Your
// courses'... clicking a row switches the active context. No confirmation
// step needed."
export function CourseSwitcher({ courses, activeCourseId }: { courses: SwitcherCourse[]; activeCourseId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const active = courses.find((c) => c.id === activeCourseId);

  function pick(courseId: string) {
    if (courseId === activeCourseId) {
      setOpen(false);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await switchActiveCourse(courseId);
      if (result.error) setError(result.error);
      else setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground disabled:opacity-70"
      >
        {active?.label ?? "—"}
        <ChevronDown className="size-3" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-1.5 w-56 rounded-[8px] border border-border bg-card p-1.5 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-muted uppercase">Your courses</p>
          {courses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pick(c.id)}
              className="flex w-full items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm text-ink hover:bg-accent"
            >
              <span className="flex items-center gap-1.5">
                {c.id === activeCourseId ? <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                {c.label}
              </span>
              <span className="text-[10px] text-muted">{c.isPartTime ? "Part-time" : "Full-time"}</span>
            </button>
          ))}
          {error ? <p className="px-2 py-1 text-xs text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
