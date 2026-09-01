"use client";

import { useActionState } from "react";
import { reassignUnownedCourse, type ReassignState } from "@/app/centre/owner/actions";

export interface UnownedCourse {
  id: string;
  name: string;
  branchName: string | null;
  startDate: string | null;
}

export interface AssignCandidate {
  centreRoleId: string;
  name: string;
}

const initialState: ReassignState = { error: null, ok: null };

/**
 * The last line of defence: a course whose course administrator is gone.
 *
 * Ramy, 1 Sep 2026, once it was clear this is not the owner running a
 * course: "reassign, then, if it's like a last line of defence." The owner
 * stays read-only on course administration -- this says who administers a
 * course, which is the one thing nobody inside the course can fix once the
 * person holding it has left.
 *
 * Deliberately invisible when there is nothing orphaned. A backstop that is
 * always on screen stops reading as an alarm.
 */
export function UnownedCoursesCard({
  courses,
  candidates,
}: {
  courses: UnownedCourse[];
  candidates: AssignCandidate[];
}) {
  const [state, action, pending] = useActionState(reassignUnownedCourse, initialState);

  if (courses.length === 0) return null;

  return (
    <div className="owner-card flex flex-col gap-4 px-7 py-6">
      <div className="flex flex-col gap-1">
        <h2 className="owner-serif text-[19px]">
          {courses.length === 1 ? "A course with no administrator" : `${courses.length} courses with no administrator`}
        </h2>
        <p className="text-[12.5px]" style={{ color: "var(--owner-muted)" }}>
          Nobody holds these. Whoever was administering them no longer does — they left, or their role was
          removed. Until someone is named, no one inside the course can invite, group or timetable.
        </p>
      </div>

      {state.error ? <p className="text-[12.5px] text-destructive">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-[12.5px]" style={{ color: "var(--owner-garnet)" }}>
          {state.ok}
        </p>
      ) : null}

      {candidates.length === 0 ? (
        // Assigning writes a scope row against an existing course
        // administrator grant, so there has to be one to write against.
        // Saying that plainly beats an empty picker.
        <p className="text-[12.5px]" style={{ color: "var(--owner-muted)" }}>
          Nobody at this centre holds a Course administrator role yet. Appoint someone on the Roles tab first, then
          hand the course over here.
        </p>
      ) : (
        <div className="flex flex-col">
          {courses.map((c, i) => (
            <form
              key={c.id}
              action={action}
              className={`owner-row-hover flex flex-wrap items-center justify-between gap-3 px-2 py-3 ${
                i > 0 ? "border-t border-[var(--owner-line)]" : ""
              }`}
            >
              <input type="hidden" name="courseId" value={c.id} />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="text-[11.5px]" style={{ color: "var(--owner-muted)" }}>
                  {[c.branchName, c.startDate ? `starts ${new Date(c.startDate).toLocaleDateString("en-GB")}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  name="centreRoleId"
                  required
                  defaultValue=""
                  className="rounded-[5px] border border-[var(--owner-line)] bg-[var(--owner-paper)] px-2.5 py-1.5 text-[13px]"
                >
                  <option value="" disabled>
                    Hand it to…
                  </option>
                  {candidates.map((p) => (
                    <option key={p.centreRoleId} value={p.centreRoleId}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={pending}
                  className="owner-pill disabled:opacity-60"
                  style={{ fontSize: "10.5px", padding: "7px 14px" }}
                >
                  {pending ? "Assigning…" : "Assign"}
                </button>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
