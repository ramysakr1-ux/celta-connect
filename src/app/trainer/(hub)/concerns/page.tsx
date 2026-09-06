import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ConcernReplyForm } from "@/app/trainer/(hub)/concerns/reply-form";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { formatDate } from "@/lib/format-date";

const ROUTE_LABEL: Record<string, string> = { tutor: "Tutor", mct: "Main Course Tutor", manager: "Centre manager" };

// Enrolment Forms.dc.html 1c -- the staff side of the internal complaints
// route.
//
// Course-wide among the TUTORS, and only for the two routes addressed to
// them. Migration 0280 took the centre-manager route out of this inbox
// entirely: the candidate's own form promises that route is "independent of
// the teaching team... for anything you would rather the tutors did not see
// first", and until then every trainer on the course could read it. That is
// the one thing Administration Handbook 16.1 actually requires -- "recourse
// to someone other than the tutors on the course" -- so it is enforced in
// RLS now, not by what this page chooses to query.
//
// Anonymous concerns never show the trainee's name here, regardless of viewer.
export default async function ConcernsInboxPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const timeZone = (await getCachedCenter(trainer.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const supabase = await createClient();

  const { data: concerns } = await supabase
    .from("concerns")
    .select("*")
    .eq("course_id", trainer.course_id ?? "")
    .order("created_at", { ascending: false });

  const traineeIds = [...new Set((concerns ?? []).filter((c) => !c.anonymous).map((c) => c.trainee_id))];
  const { data: trainees } = traineeIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", traineeIds) : { data: [] };
  const nameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet">
        <p className="text-xs text-muted">{(concerns ?? []).length} total</p>
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Today</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">Concerns</h1>
        <p className="mt-1 text-sm text-muted">
          Concerns candidates raised with a tutor or with you. Every one gets a reply.
        </p>
        {/* Said plainly, and without a count: a number here would itself tell
            the tutors that somebody had gone over their heads, which is the
            thing the route exists to prevent. */}
        <p className="mt-2 text-xs text-muted">
          Concerns sent to the centre manager are not shown here and never will be. Administration Handbook &sect;16.1 requires a
          route with recourse beyond the course tutors; the centre answers those.
        </p>
      </div>

      {(concerns ?? []).length === 0 ? (
        <p className="sheet text-sm text-muted">No concerns raised yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {(concerns ?? []).map((c) => (
            <div key={c.id} className="sheet flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-ink">
                  {c.anonymous ? "Anonymous" : (nameById.get(c.trainee_id) ?? "Unknown")}
                  <span className="ml-2 text-xs font-normal text-muted">Routed to {ROUTE_LABEL[c.route] ?? c.route}</span>
                </p>
                <p className="text-xs text-muted">{formatDate(c.created_at, timeZone, { year: "numeric" })}</p>
              </div>
              <p className="text-sm whitespace-pre-wrap text-ink">{c.body}</p>

              {c.response ? (
                <div className="mt-1 rounded-[6px] bg-surface-muted/40 p-3">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    Replied {c.responded_at ? formatDate(c.responded_at, timeZone) : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink">{c.response}</p>
                </div>
              ) : (
                <ConcernReplyForm concernId={c.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
