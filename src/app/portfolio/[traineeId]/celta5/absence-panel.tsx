"use client";

import { useActionState, useState } from "react";
import { reportOwnAbsence, type AbsenceFormState } from "@/app/portfolio/[traineeId]/status-actions";
import type { Database } from "@/lib/supabase/types";

type Absence = Database["public"]["Tables"]["attendance_absences"]["Row"];

const initial: AbsenceFormState = { error: null };

// Ramy, 29 Aug 2026: "the trainee side should also show the attendance --
// it's like for absences. If they skip something, then they have to record
// it."
//
// The trainer's CELTA 5 page already had an attendance form; the
// candidate's had nothing, so the only way an absence reached the record
// was a tutor typing it in afterwards. This is the candidate's own
// declaration, which is the right way round: they know they missed it.
//
// Read-only after filing. A declared absence is a record, not a draft --
// if they get it wrong they tell their tutor, who can already edit it.
export function AbsencePanel({
  absences,
  hoursAttended,
  totalHours,
  // Inside the booklet, Section 5 already prints "Record of attendance",
  // the hours and Cambridge's two tables -- so this renders only the thing
  // the paper form has no way of doing: letting the candidate add a row.
  // Ramy, 29 Aug 2026: "be careful not to duplicate... it just feels like
  // you're building two over each other."
  variant = "card",
}: {
  absences: Absence[];
  hoursAttended: number | null;
  totalHours: number;
  variant?: "card" | "booklet";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportOwnAbsence, initial);
  const booklet = variant === "booklet";

  return (
    <div className={booklet ? "flex flex-col gap-3" : "sheet flex flex-col gap-3"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          {booklet ? null : <h3 className="font-serif text-lg text-ink">Attendance</h3>}
          <p className={booklet ? "text-[10px] text-muted" : "mt-0.5 text-xs text-muted"}>
            {booklet
              ? "If you miss any part of a session, record it here — your tutor sees it, and it goes on your CELTA 5."
              : `${hoursAttended !== null ? `${hoursAttended} of ${totalHours} hours recorded by your tutor.` : `${totalHours} contact hours on this course.`} If you miss any part of a session, record it here — your tutor sees it, and it goes on your CELTA 5.`}
          </p>
        </div>
        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-[6px] border border-border px-3 py-1.5 text-xs font-semibold text-ink trainee-hover-fill"
          >
            Record an absence
          </button>
        ) : null}
      </div>

      {!booklet && absences.length > 0 ? (
        <ul className="flex flex-col divide-y divide-border-faint">
          {absences.map((a) => (
            <li key={a.id} className="flex flex-col gap-0.5 py-2.5 first:pt-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-ink">
                  {a.session_date ? new Date(`${a.session_date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "Date not given"}
                </p>
                <span className={`pill shrink-0 ${a.category === "unavoidable" ? "pill-neutral" : "pill-warning"}`}>
                  {a.category === "unavoidable" ? "Unavoidable" : "Other"}
                </span>
              </div>
              {a.reason ? <p className="text-xs text-muted">{a.reason}</p> : null}
              {a.work_made_up ? <p className="text-xs text-muted">Made up: {a.work_made_up}</p> : null}
              {/* The tutor's own response, when there is one -- shown to the
                  candidate rather than kept on the trainer side, since it is
                  about them and ends up on their CELTA 5 either way. */}
              {a.tutor_comment ? (
                <p className="mt-1 rounded-[6px] border border-border-faint bg-accent/20 px-2.5 py-1.5 text-xs text-ink">
                  <span className="font-semibold text-primary">Your tutor — </span>
                  {a.tutor_comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : booklet ? null : (
        // Redundant inside the booklet: Cambridge's own two tables are
        // already on the page, showing their empty rows.
        <p className="text-sm text-muted">No absences recorded.</p>
      )}

      {open ? (
        <form action={formAction} className="flex flex-col gap-2 border-t border-border-faint pt-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
            Which day did you miss?
            <input type="date" name="session_date" required className="rounded-[6px] border border-border bg-card-inset px-2.5 py-1.5 text-sm font-normal text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
            Was it unavoidable?
            <select name="category" required defaultValue="unavoidable" className="rounded-[6px] border border-border bg-card-inset px-2.5 py-1.5 text-sm font-normal text-ink outline-none focus:border-primary">
              <option value="unavoidable">Unavoidable — illness, emergency</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
            What happened?
            <textarea name="reason" required rows={2} placeholder="A short line is enough." className="rounded-[6px] border border-border bg-card-inset px-2.5 py-1.5 text-sm font-normal text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink">
            Have you made the work up? <span className="font-normal text-muted">(optional)</span>
            <input type="text" name="work_made_up" placeholder="e.g. watched the recording, read the input session" className="rounded-[6px] border border-border bg-card-inset px-2.5 py-1.5 text-sm font-normal text-ink outline-none focus:border-primary" />
          </label>
          {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {pending ? "Saving…" : "Record it"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-ink">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-muted">Once recorded this cannot be edited here — tell your tutor if you need it changed.</p>
        </form>
      ) : null}
    </div>
  );
}
