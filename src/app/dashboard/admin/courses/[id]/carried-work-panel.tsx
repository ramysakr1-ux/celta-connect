import { linkRestartTransfer } from "@/app/dashboard/admin/courses/[id]/restart-actions";
import { linkDeferralTransfer } from "@/app/dashboard/admin/courses/[id]/deferral-actions";

export interface PendingTransfer {
  id: string;
  kind: "restart" | "deferral";
  sourceName: string;
  sourceCourseName: string;
  markedOn: string;
  note: string | null;
  /** "4 assignments · 3 taught TPs · CELTA 5" -- what the frozen snapshot holds. */
  carries: string;
  /** Handbook 7.9: a deferral into a different delivery mode needs the
   *  candidate's written agreement. Only ever true for a deferral. */
  modeChanged: boolean;
  sourceMode: string | null;
  destinationMode: string | null;
}

// specs/build-spec.md §3, the destination side of a restart or a deferral.
//
// The source side has always been live: a member of staff marks a candidate
// for restart or deferral on their portfolio (withdraw-card.tsx), which
// freezes what they had done into a restart_transfers / deferral_transfers
// row. The destination side -- linking that frozen work to the person once
// they join the new course -- had no door anywhere in the app from the day
// Course Admin's course record was trimmed (23 Aug 2026) until this panel
// (16 Sep 2026). linkRestartTransfer and linkDeferralTransfer were written,
// tested by nothing, and unreachable, so a candidate's carried work sat in
// the row and never arrived.
//
// It lives here because this is the DESTINATION course's own record, which
// is what both actions revalidate, and because linking is admissions work:
// it is the same capability that admits someone in the first place.
export function CarriedWorkPanel({
  courseId,
  transfers,
  trainees,
}: {
  courseId: string;
  transfers: PendingTransfer[];
  trainees: { id: string; full_name: string }[];
}) {
  if (transfers.length === 0) return null;

  return (
    <div className="card card-amber flex flex-col gap-4 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">Carried work waiting to be linked</h2>
        <p className="mt-1 text-sm text-muted">
          {transfers.length === 1 ? "A candidate was" : `${transfers.length} candidates were`}{" "}
          marked for a restart or a deferral on an earlier course, and what they had already done is being held. Once they have joined this
          course, say which person they are and their work is written onto this course&apos;s record.
        </p>
      </div>

      {trainees.length === 0 ? (
        <p className="text-sm text-muted">
          Nobody has joined this course yet. The work keeps until they do &mdash; nothing expires.
        </p>
      ) : null}

      {transfers.map((t) => (
        <form
          key={t.id}
          action={t.kind === "restart" ? linkRestartTransfer : linkDeferralTransfer}
          className="flex flex-col gap-3 rounded-[10px] border border-border bg-card-inset p-4"
        >
          <input type="hidden" name="transfer_id" value={t.id} />
          <input type="hidden" name="course_id" value={courseId} />

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{t.sourceName}</p>
            <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold text-muted">
              {t.kind === "restart" ? "Restart" : "Deferral"}
            </span>
          </div>
          <p className="text-xs text-muted">
            From {t.sourceCourseName}, marked {t.markedOn} &middot; carries {t.carries}
          </p>
          {t.note ? <p className="text-xs text-muted italic">&ldquo;{t.note}&rdquo;</p> : null}

          {/* Handbook 7.9 (June 2025): "The new course should be in the same
              mode of delivery as the original course, unless otherwise agreed
              in writing by the candidate." The action refuses the link
              without the tick, so the form says why rather than failing
              silently. */}
          {t.modeChanged ? (
            <div className="flex flex-col gap-2 rounded-[8px] border border-status-warning-text/40 bg-status-warning-bg p-3">
              <p className="text-xs text-status-warning-text">
                This course is {t.destinationMode ?? "a different mode"}; their original course was{" "}
                {t.sourceMode ?? "another mode"}. Handbook 7.9 asks for the candidate&apos;s agreement in writing
                before a deferral changes mode.
              </p>
              <label className="flex items-start gap-2 text-xs text-ink">
                <input type="checkbox" name="mode_change_agreed" required className="mt-0.5" />
                The candidate has agreed to the change of mode in writing.
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                How they will be brought up to speed in the new mode
                <textarea
                  name="familiarisation_plan"
                  rows={2}
                  className="rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs text-muted">
              Who are they on this course?
              <select
                name="destination_trainee_id"
                required
                defaultValue=""
                className="h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
              >
                <option value="" disabled>
                  Choose a candidate…
                </option>
                {trainees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={trainees.length === 0}
              className="h-10 rounded-[6px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Link their work
            </button>
          </div>
          <p className="text-xs text-muted">
            This writes their carried work onto this course and cannot be undone from here.
          </p>
        </form>
      ))}
    </div>
  );
}
