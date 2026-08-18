import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { GTKY_BANK } from "@/lib/gtky-activities";
import { assignGtkyActivities } from "@/app/trainer/(hub)/gtky/actions";

const BAND_LABELS: Record<string, string> = {
  a1: "Beginner",
  elem: "Elementary",
  pre: "Pre-Intermediate",
  inter: "Intermediate",
  upper: "Upper-Intermediate",
};

// design_handoff_open_items_batch, GTKY Activity Bank.dc.html §1b -- "who
// does what and when." Trainer-facing: trigger the assignment once TP
// groups and TP1's coursebook level are set, then see the running order.
export default async function GtkyPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  const supabase = await createClient();
  const courseId = trainer.course_id;

  const [{ data: assignments }, { data: trainees }] = await Promise.all([
    supabase.from("gtky_assignments").select("*").eq("course_id", courseId),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee").eq("course_status", "active"),
  ]);
  const nameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));
  const activityBySlug = new Map(GTKY_BANK.map((a) => [a.slug, a]));

  const assignedCount = assignments?.length ?? 0;
  const chosenCount = (assignments ?? []).filter((a) => a.chosen_slug).length;
  const unassignedCount = (trainees?.length ?? 0) - assignedCount;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Getting to know you -- day one</h1>
        <p className="mt-1 text-sm text-muted">
          Twenty minutes each, unassessed, the tutor not in the room. Three activities offered per candidate, matched
          to the level they will teach; they choose one and tell you on the first morning.
        </p>
      </div>

      <div className="sheet flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink">
            {assignedCount} of {trainees?.length ?? 0} candidates assigned · {chosenCount} have chosen
          </p>
          {unassignedCount > 0 ? (
            <p className="mt-1 text-xs text-muted">
              {unassignedCount} still waiting -- typically because their TP1 coursebook level isn&apos;t set yet.
            </p>
          ) : null}
        </div>
        <form action={assignGtkyActivities}>
          <button
            type="submit"
            className="rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Assign GTKY activities
          </button>
        </form>
      </div>

      {assignedCount > 0 ? (
        <div className="sheet overflow-hidden !p-0">
          <table className="table-plain w-full">
            <thead>
              <tr>
                <th className="text-sm text-muted">Candidate</th>
                <th className="text-sm text-muted">Level</th>
                <th className="text-sm text-muted">Offered</th>
                <th className="text-sm text-muted">Chosen</th>
              </tr>
            </thead>
            <tbody>
              {(assignments ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="text-ink">{nameById.get(a.trainee_id) ?? "Unknown"}</td>
                  <td className="text-muted">{BAND_LABELS[a.level_band] ?? a.level_band}</td>
                  <td className="text-muted">
                    {a.offered_slugs.map((s) => activityBySlug.get(s)?.name ?? s).join(", ")}
                  </td>
                  <td className={a.chosen_slug ? "text-ink" : "text-muted"}>
                    {a.chosen_slug ? activityBySlug.get(a.chosen_slug)?.name ?? a.chosen_slug : "Not yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
