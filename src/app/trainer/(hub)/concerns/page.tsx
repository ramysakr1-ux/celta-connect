import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ConcernReplyForm } from "@/app/trainer/(hub)/concerns/reply-form";

const ROUTE_LABEL: Record<string, string> = { tutor: "Tutor", mct: "Main Course Tutor", manager: "Centre manager" };

// Enrolment Forms.dc.html 1c -- the staff side of the internal complaints
// route. Course-wide visibility (see migration 0140): any trainer/admin can
// read and reply, since the design's own escalation text frames this as
// "the centre replies," not one gatekept recipient. Anonymous concerns
// never show the trainee's name here, regardless of viewer.
export default async function ConcernsInboxPage() {
  const trainer = await requireRole(["trainer", "admin"]);
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
        <h1 className="mt-0.5 font-serif text-xl text-ink">Concerns</h1>
        <p className="mt-1 text-sm text-muted">
          Admin Handbook requires an internal complaints route with recourse beyond the tutors. The centre replies to
          every concern.
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
                  <span className="ml-2 text-xs font-normal text-muted">→ {ROUTE_LABEL[c.route] ?? c.route}</span>
                </p>
                <p className="text-xs text-muted">{new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <p className="text-sm whitespace-pre-wrap text-ink">{c.body}</p>

              {c.response ? (
                <div className="mt-1 rounded-[6px] bg-surface-muted/40 p-3">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
                    Replied {c.responded_at ? new Date(c.responded_at).toLocaleDateString("en-GB") : ""}
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
