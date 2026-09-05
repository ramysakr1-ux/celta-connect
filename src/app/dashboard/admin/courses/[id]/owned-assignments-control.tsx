"use client";

import { updateOwnedAssignmentTypes } from "./invitation-actions";

const ASSIGNMENT_TYPES = ["Focus on Learner", "LRT", "Skills", "LfC"] as const;
const SHORT_LABEL: Record<(typeof ASSIGNMENT_TYPES)[number], string> = {
  "Focus on Learner": "FoL",
  LRT: "LRT",
  Skills: "SRT",
  LfC: "LfC",
};

// connect-spec-corrections-for-claude-code.md item 7: which assignments
// this tutor owns for marking -- MCT-set, separate from their TP group.
// Each checkbox submits the whole set on change, same "no Save button,
// one action, immediate" pattern as TutorRoleControl next to it.
export function OwnedAssignmentsControl({
  courseTutorId,
  courseId,
  owned,
  variant = "checkboxes",
}: {
  courseTutorId: string;
  courseId: string;
  owned: string[];
  /** "chips": cream chip per owned assignment, faint dashed chip when not owned -- the trainer hub's roster. Still a checkbox underneath. */
  variant?: "checkboxes" | "chips";
}) {
  return (
    <form action={updateOwnedAssignmentTypes} className={`flex flex-wrap items-center ${variant === "chips" ? "gap-1" : "gap-2"}`}>
      <input type="hidden" name="course_tutor_id" value={courseTutorId} />
      <input type="hidden" name="course_id" value={courseId} />
      {ASSIGNMENT_TYPES.map((type) => (
        <label
          key={type}
          title={variant === "chips" ? `${type} -- click to ${owned.includes(type) ? "stop" : "start"} marking this assignment` : undefined}
          className={
            variant === "chips"
              ? "cursor-pointer rounded-[6px] border border-dashed border-border px-2 py-[3px] text-[10.5px] font-bold whitespace-nowrap text-muted/70 has-[:checked]:border-transparent has-[:checked]:bg-card-inset has-[:checked]:text-[oklch(44%_0.014_70)]"
              : "flex items-center gap-1 text-[11px] text-muted"
          }
        >
          <input
            type="checkbox"
            name="owned_assignment_types"
            value={type}
            defaultChecked={owned.includes(type)}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={variant === "chips" ? "sr-only" : "size-3"}
          />
          {SHORT_LABEL[type]}
        </label>
      ))}
    </form>
  );
}
