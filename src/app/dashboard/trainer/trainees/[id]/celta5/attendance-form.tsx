"use client";

import { useActionState } from "react";
import {
  addAbsence,
  updateAttendance,
  type FormState,
} from "@/app/dashboard/trainer/celta5-actions";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];
type Absence = Database["public"]["Tables"]["attendance_absences"]["Row"];

const initialState: FormState = { error: null };

export function AttendanceForm({
  record,
  totalHours,
  absences,
}: {
  record: Celta5Record;
  totalHours: number;
  absences: Absence[];
}) {
  const [hoursState, hoursAction, hoursPending] = useActionState(updateAttendance, initialState);
  const [absenceState, absenceAction, absencePending] = useActionState(addAbsence, initialState);

  return (
    <div className="card flex flex-col gap-4 p-6">
      <h2 className="font-serif text-lg text-ink">Attendance</h2>

      <form action={hoursAction} className="flex items-end gap-3">
        <input type="hidden" name="trainee_id" value={record.trainee_id} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted">Hours attended (of {totalHours})</label>
          <input
            name="hours_attended"
            type="number"
            step="0.5"
            defaultValue={record.hours_attended ?? ""}
            className="w-32 rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={hoursPending}
          className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
        >
          {hoursPending ? "Saving..." : "Save"}
        </button>
      </form>
      {hoursState.error ? <p className="text-sm text-destructive">{hoursState.error}</p> : null}

      {absences.length > 0 ? (
        <div className="overflow-hidden rounded-[6px] border border-border">
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">Date</th>
                <th className="text-sm text-muted">Category</th>
                <th className="text-sm text-muted">Reason</th>
              </tr>
            </thead>
            <tbody>
              {absences.map((a) => (
                <tr key={a.id}>
                  <td className="text-ink">{a.session_date ?? "--"}</td>
                  <td className="text-muted capitalize">{a.category}</td>
                  <td className="text-muted">{a.reason ?? "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form action={absenceAction} className="flex flex-col gap-3 border-t border-border pt-4">
        <input type="hidden" name="trainee_id" value={record.trainee_id} />
        <h3 className="text-sm font-medium text-ink">Log an absence</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Session date</label>
            <input
              name="session_date"
              type="date"
              className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted">Category</label>
            <select
              name="category"
              defaultValue="unavoidable"
              className="appearance-none rounded-[6px] border border-border bg-card px-3 py-2 text-center text-sm text-ink outline-none focus:border-primary"
            >
              <option value="unavoidable">Unavoidable</option>
              <option value="other">Other / unexplained</option>
            </select>
          </div>
        </div>
        <input
          name="reason"
          type="text"
          placeholder="Reason"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <input
          name="work_made_up"
          type="text"
          placeholder="How work was made up"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        {absenceState.error ? (
          <p className="text-sm text-destructive">{absenceState.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={absencePending}
          className="self-start rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary disabled:opacity-60"
        >
          {absencePending ? "Saving..." : "Add absence"}
        </button>
      </form>
    </div>
  );
}
