import Link from "next/link";
import { requireAdmissionsHandler } from "@/lib/admissions-access";
import { createClient } from "@/lib/supabase/server";
import { createInterviewSlot } from "@/app/dashboard/admissions/actions";
import { OfferNextPlaceForm } from "@/app/dashboard/admissions/offer-next-place-form";

const STAGE_LABEL: Record<string, string> = {
  submitted: "Submitted",
  task_returned: "Task returned",
  interview_booked: "Interview booked",
  interview_completed: "Interview completed -- decision needed",
  offer_sent: "Offer sent",
  accepted: "Accepted",
  rejected_before_interview: "Rejected (before interview)",
  rejected_after_interview: "Rejected (after interview)",
  waiting_list: "Waiting list",
  not_this_time: "Not this time -- course full",
  withdrawn_application: "Withdrawn",
};

// "Selection lives outside the course, and outside course roles" -- this
// is the centre-level pipeline, not scoped to one course, though slot
// creation asks which intake a given interview is for.
export default async function AdmissionsPage() {
  const staff = await requireAdmissionsHandler();
  const supabase = await createClient();

  const [{ data: applicants }, { data: intakes }, { data: openSlots }] = await Promise.all([
    supabase
      .from("applicants")
      .select("id, full_name, email, stage, intake_course_id, created_at")
      .eq("center_id", staff.center_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("courses")
      .select("id, name")
      .eq("center_id", staff.center_id)
      .eq("accepting_applications", true)
      .order("start_date"),
    supabase
      .from("interview_slots")
      .select("id, intake_course_id, slot_date, slot_time, mode, panel, booked_applicant_id")
      .eq("center_id", staff.center_id)
      .is("booked_applicant_id", null)
      .order("slot_date"),
  ]);

  const intakeNameById = new Map((intakes ?? []).map((i) => [i.id, i.name]));

  // Waiting-list counts per intake -- fetched independent of the
  // "accepting_applications" intakes above, since a course can still have
  // a waiting list after being closed to new applications.
  const { data: waitingApplicants } = await supabase
    .from("applicants")
    .select("intake_course_id")
    .eq("center_id", staff.center_id)
    .eq("stage", "waiting_list")
    .eq("waiting_list_opt_out", false);
  const waitingIntakeIds = Array.from(new Set((waitingApplicants ?? []).map((a) => a.intake_course_id)));
  const { data: waitingIntakeCourses } =
    waitingIntakeIds.length > 0
      ? await supabase.from("courses").select("id, name").in("id", waitingIntakeIds)
      : { data: [] as { id: string; name: string }[] };
  const waitingIntakeNameById = new Map((waitingIntakeCourses ?? []).map((c) => [c.id, c.name]));
  const waitingByIntake = new Map<string, { name: string; count: number }>();
  for (const a of waitingApplicants ?? []) {
    const existing = waitingByIntake.get(a.intake_course_id);
    waitingByIntake.set(a.intake_course_id, {
      name: waitingIntakeNameById.get(a.intake_course_id) ?? "--",
      count: (existing?.count ?? 0) + 1,
    });
  }

  const stale = (applicants ?? []).filter(
    (a) => !["accepted", "rejected_before_interview", "rejected_after_interview", "not_this_time", "withdrawn_application"].includes(a.stage)
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">Admissions</h1>
          <p className="mt-2 text-muted">The applicant pipeline for every course at your centre.</p>
        </div>
        <Link href="/dashboard/admissions/settings" className="text-sm text-muted hover:text-ink">
          Settings
        </Link>
      </div>

      <div className="card overflow-hidden !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">Name</th>
              <th className="text-sm text-muted">Intake</th>
              <th className="text-sm text-muted">Stage</th>
              <th className="text-sm text-muted">Applied</th>
            </tr>
          </thead>
          <tbody>
            {stale.length > 0 ? (
              stale.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/dashboard/admissions/${a.id}`} className="font-medium text-ink hover:underline">
                      {a.full_name}
                    </Link>
                  </td>
                  <td className="text-muted">{intakeNameById.get(a.intake_course_id) ?? "--"}</td>
                  <td>
                    <span className="status-pill status-pill-pending">{STAGE_LABEL[a.stage] ?? a.stage}</span>
                  </td>
                  <td className="text-muted">{a.created_at.slice(0, 10)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-muted">
                  No applicants awaiting a decision.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">Open interview slots</h2>
        {(openSlots ?? []).length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {(openSlots ?? []).map((s) => (
              <li key={s.id} className="text-sm text-ink">
                {intakeNameById.get(s.intake_course_id) ?? "--"} -- {s.slot_date} {s.slot_time} ({s.mode === "online" ? "Online" : "Face to face"}
                {s.panel ? ", panel" : ""})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No open slots. Create one below.</p>
        )}

        {intakes && intakes.length > 0 ? (
          <form action={createInterviewSlot} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="intake_course_id" className="text-xs text-muted">
                Intake
              </label>
              <select id="intake_course_id" name="intake_course_id" required className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink">
                {intakes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="slot_date" className="text-xs text-muted">
                Date
              </label>
              <input id="slot_date" name="slot_date" type="date" required className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="slot_time" className="text-xs text-muted">
                Time
              </label>
              <input id="slot_time" name="slot_time" type="time" required className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mode" className="text-xs text-muted">
                Mode
              </label>
              <select id="mode" name="mode" required className="h-9 rounded-[6px] border border-input bg-card px-2 text-sm text-ink">
                <option value="face_to_face">Face to face</option>
                <option value="online">Online</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 pb-2 text-xs text-ink">
              <input type="checkbox" name="panel" />A panel (second interviewer)
            </label>
            <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
              Create slot
            </button>
          </form>
        ) : (
          <p className="text-xs text-muted">Open a course for applications first (from its admin page) to book interview slots.</p>
        )}
      </div>

      {waitingByIntake.size > 0 ? (
        <div className="card flex flex-col gap-4 p-6">
          <h2 className="font-serif text-lg text-ink">Waiting lists</h2>
          <p className="text-sm text-muted">
            When a place frees up (a withdrawal, deferral, or a lapsed offer), offer it to whoever's next -- the app
            picks who, not you.
          </p>
          <ul className="flex flex-col gap-3">
            {Array.from(waitingByIntake.entries()).map(([intakeCourseId, { name, count }]) => (
              <li key={intakeCourseId} className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm text-ink">{name}</span>
                <OfferNextPlaceForm intakeCourseId={intakeCourseId} waitingCount={count} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
