import { addToWaitingList } from "@/app/dashboard/admissions/actions";

// "Position, the course, and a date by which they will hear either way.
// Without that date it is just an unanswered application."
export function WaitingListForm({ applicantId }: { applicantId: string }) {
  return (
    <form action={addToWaitingList} className="card flex flex-wrap items-end gap-3 p-6">
      <input type="hidden" name="applicant_id" value={applicantId} />
      <div>
        <h2 className="font-serif text-lg text-ink">Waiting list</h2>
        <p className="mt-1 text-sm text-muted">
          For when the intake is full. Their task and interview stay on file -- they never repeat them.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="waiting_list_hear_by" className="text-xs text-muted">
          They&apos;ll hear either way by
        </label>
        <input
          id="waiting_list_hear_by"
          name="waiting_list_hear_by"
          type="date"
          required
          className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
        />
      </div>
      <button type="submit" className="rounded-[6px] border border-border px-3 py-2 text-sm text-ink hover:border-primary">
        Add to waiting list
      </button>
    </form>
  );
}
