import Link from "next/link";
import { requireAdmissionsHandler } from "@/lib/admissions-access";
import { createClient } from "@/lib/supabase/server";
import { createInterviewSlot } from "@/app/dashboard/admissions/actions";
import { OfferNextPlaceForm } from "@/app/dashboard/admissions/offer-next-place-form";
import { InterviewAvailabilityPanel, type PatternRow, type BlockRow } from "@/app/dashboard/admissions/interview-availability-panel";
import { MARKETING_SOURCE_LABEL, type MarketingSource } from "@/lib/marketing-source";

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

  // Ramy, 28 Aug 2026: "admission pipeline takes forever" -- traced the same
  // way as Centre Management. This page ran its main 7-query batch, then
  // pendingReferralCount and waitingApplicants each alone afterward, then
  // waitingIntakeCourses after THAT -- four sequential stages where only
  // one real dependency exists (waitingIntakeCourses genuinely needs
  // waitingIntakeIds from waitingApplicants). pendingReferralCount and
  // waitingApplicants both only need staff.center_id, already known before
  // the very first query -- folded into the same batch as everything else.
  const [
    { data: applicants },
    { data: intakes },
    { data: openSlots },
    { data: interviewStaff },
    { data: patternRows },
    { data: blockRows },
    { data: center },
    { count: pendingReferralCount },
    { data: waitingApplicants },
  ] = await Promise.all([
    supabase
      .from("applicants")
      .select("id, full_name, email, stage, intake_course_id, created_at, deposit_amount, deposit_paid_at, ai_reading_lane, marketing_source")
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
    supabase.from("profiles").select("id, full_name").eq("center_id", staff.center_id).in("role", ["admin", "trainer"]).order("full_name"),
    supabase.from("interview_availability_patterns").select("*").eq("center_id", staff.center_id).eq("active", true),
    supabase.from("interview_blocks").select("*").eq("center_id", staff.center_id).order("start_date"),
    supabase
      .from("centers")
      .select("interview_slot_minutes, interview_gap_minutes, interview_weeks_ahead, interview_cutoff_hours")
      .eq("id", staff.center_id)
      .maybeSingle(),
    // "The area owner is notified... a statement, so they are not told by a
    // candidate." A count here is that statement for referral requests --
    // the dedicated page (referral-requests/page.tsx) is where they're
    // actually decided.
    supabase.from("branch_referral_requests").select("id", { count: "exact", head: true }).eq("to_center_id", staff.center_id).eq("status", "pending"),
    // Waiting-list counts per intake -- fetched independent of the
    // "accepting_applications" intakes above, since a course can still have
    // a waiting list after being closed to new applications.
    supabase.from("applicants").select("intake_course_id").eq("center_id", staff.center_id).eq("stage", "waiting_list").eq("waiting_list_opt_out", false),
  ]);

  const intakeNameById = new Map((intakes ?? []).map((i) => [i.id, i.name]));
  const staffNameById = new Map((interviewStaff ?? []).map((s) => [s.id, s.full_name]));
  const interviewerOptions = (interviewStaff ?? []).map((s) => ({ id: s.id, name: s.full_name }));
  const patterns: PatternRow[] = (patternRows ?? []).map((p) => ({
    id: p.id,
    interviewerId: p.interviewer_id,
    interviewerName: staffNameById.get(p.interviewer_id) ?? "Unknown",
    weekday: p.weekday,
    startTime: p.start_time,
    endTime: p.end_time,
    mode: p.mode,
  }));
  const blocks: BlockRow[] = (blockRows ?? []).map((b) => ({
    id: b.id,
    interviewerName: b.interviewer_id ? (staffNameById.get(b.interviewer_id) ?? "Unknown") : null,
    startDate: b.start_date,
    endDate: b.end_date,
    startTime: b.start_time,
    endTime: b.end_time,
    reason: b.reason,
  }));
  const generationSettings = {
    slotMinutes: center?.interview_slot_minutes ?? 45,
    gapMinutes: center?.interview_gap_minutes ?? 10,
    weeksAhead: center?.interview_weeks_ahead ?? 3,
    cutoffHours: center?.interview_cutoff_hours ?? 24,
  };

  // Waiting-list counts per intake -- fetched independent of the
  // "accepting_applications" intakes above, since a course can still have
  // a waiting list after being closed to new applications.
  const waitingIntakeIds = Array.from(new Set((waitingApplicants ?? []).map((a) => a.intake_course_id)));

  // for-claude-code-marketing-source-question.md: "a simple per-course
  // breakdown (count/percentage per source)" for the centre's own
  // marketing, across every applicant regardless of stage -- not just the
  // currently-accepting intakes intakeNameById covers, so this looks up
  // course names for every course any applicant is actually linked to.
  const marketingCourseIds = Array.from(new Set((applicants ?? []).map((a) => a.intake_course_id)));

  // waitingIntakeCourses genuinely needs waitingIntakeIds (just resolved
  // above); marketingCourses only needs marketingCourseIds, which came from
  // `applicants` in the very first batch -- the two don't depend on each
  // other, so they run together instead of one after the other.
  const [{ data: waitingIntakeCourses }, { data: marketingCourses }] = await Promise.all([
    waitingIntakeIds.length > 0
      ? supabase.from("courses").select("id, name").in("id", waitingIntakeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    marketingCourseIds.length > 0
      ? supabase.from("courses").select("id, name").in("id", marketingCourseIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const waitingIntakeNameById = new Map((waitingIntakeCourses ?? []).map((c) => [c.id, c.name]));
  const waitingByIntake = new Map<string, { name: string; count: number }>();
  for (const a of waitingApplicants ?? []) {
    const existing = waitingByIntake.get(a.intake_course_id);
    waitingByIntake.set(a.intake_course_id, {
      name: waitingIntakeNameById.get(a.intake_course_id) ?? "--",
      count: (existing?.count ?? 0) + 1,
    });
  }

  const marketingCourseNameById = new Map((marketingCourses ?? []).map((c) => [c.id, c.name]));
  const marketingByCourse = new Map<string, { name: string; total: number; counts: Partial<Record<MarketingSource, number>> }>();
  for (const a of applicants ?? []) {
    if (!a.marketing_source) continue;
    const entry = marketingByCourse.get(a.intake_course_id) ?? {
      name: marketingCourseNameById.get(a.intake_course_id) ?? "--",
      total: 0,
      counts: {},
    };
    entry.total += 1;
    const source = a.marketing_source as MarketingSource;
    entry.counts[source] = (entry.counts[source] ?? 0) + 1;
    marketingByCourse.set(a.intake_course_id, entry);
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
        {/* The five links that used to sit here are the room's tab row now
            (admissions-tabs.tsx). They were listed on this page alone, and
            none of the five repeated them, so every one of them was a dead
            end. Email preview and delivery moved into Settings -- they are
            things you check, not a daily job. */}
      </div>

      {/* Purely decorative teal/garnet alternation down this page's stack of
          plain cards -- same treatment as the Centre Management pilot
          (src/app/centre/page.tsx). None of these carry a status of their
          own. */}
      <div className="card card-garnet overflow-hidden !p-0">
        <table className="table-plain w-full">
          <thead>
            <tr>
              <th className="text-sm text-muted">Name</th>
              <th className="text-sm text-muted">Intake</th>
              <th className="text-sm text-muted">Stage</th>
              <th className="text-sm text-muted">Deposit</th>
              <th className="text-sm text-muted">Applied</th>
            </tr>
          </thead>
          <tbody>
            {stale.length > 0 ? (
              stale.map((a) => (
                <tr key={a.id} className="admin-hover">
                  <td>
                    <Link href={`/dashboard/admissions/${a.id}`} className="font-medium text-ink hover:underline">
                      {a.full_name}
                    </Link>
                    {a.ai_reading_lane === "clear_problems" ? (
                      // "A tutor is notified... in-app flag, not push/email"
                      // -- this table is the surface a tutor or admissions
                      // handler actually scans, so the flag lives here.
                      <span className="ml-2 rounded-full border border-destructive/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-destructive">
                        Task reading: read directly
                      </span>
                    ) : null}
                  </td>
                  <td className="text-muted">{intakeNameById.get(a.intake_course_id) ?? "--"}</td>
                  <td>
                    <span className="status-pill status-pill-pending">{STAGE_LABEL[a.stage] ?? a.stage}</span>
                  </td>
                  {/* The deposit is what lets a centre invite someone before
                      the balance is settled, so it belongs in the list you scan
                      when deciding who to invite -- not only on the detail
                      page. */}
                  <td className={a.deposit_paid_at ? "text-ink" : "text-muted"}>
                    {a.deposit_paid_at ? `${a.deposit_amount}` : "--"}
                  </td>
                  <td className="text-muted">{a.created_at.slice(0, 10)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="text-muted">
                  No applicants awaiting a decision.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Interview availability</h2>
        <p className="mt-1 text-sm text-muted">Slots are generated from a rule, not typed in every week.</p>
        <div className="mt-4">
          <InterviewAvailabilityPanel interviewers={interviewerOptions} patterns={patterns} blocks={blocks} settings={generationSettings} />
        </div>
      </div>

      <div className="card card-garnet flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">Open interview slots</h2>
        {(openSlots ?? []).length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {(openSlots ?? []).map((s) => (
              <li key={s.id} className="text-sm text-ink admin-hover">
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
              <select id="intake_course_id" name="intake_course_id" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink">
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
              <input id="slot_date" name="slot_date" type="date" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="slot_time" className="text-xs text-muted">
                Time
              </label>
              <input id="slot_time" name="slot_time" type="time" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mode" className="text-xs text-muted">
                Mode
              </label>
              <select id="mode" name="mode" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink">
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

      {marketingByCourse.size > 0 ? (
        <div className="card flex flex-col gap-4 p-6">
          <h2 className="font-serif text-lg text-ink">How they heard about us</h2>
          <p className="text-sm text-muted">Centre marketing only -- not part of any candidate's academic record.</p>
          <ul className="flex flex-col gap-4">
            {Array.from(marketingByCourse.entries()).map(([courseId, { name, total, counts }]) => (
              <li key={courseId} className="border-t border-border pt-3 admin-hover">
                <p className="text-sm font-medium text-ink">
                  {name} <span className="font-normal text-muted">({total})</span>
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {(Object.entries(counts) as [MarketingSource, number][])
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count]) => (
                      <li key={source} className="flex items-center justify-between text-xs text-muted">
                        <span>{MARKETING_SOURCE_LABEL[source]}</span>
                        <span>
                          {count} ({Math.round((count / total) * 100)}%)
                        </span>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {waitingByIntake.size > 0 ? (
        <div className="card card-garnet flex flex-col gap-4 p-6">
          <h2 className="font-serif text-lg text-ink">Waiting lists</h2>
          <p className="text-sm text-muted">
            When a place frees up (a withdrawal, deferral, or a lapsed offer), offer it to whoever&apos;s next -- the app
            picks who, not you.
          </p>
          <ul className="flex flex-col gap-3">
            {Array.from(waitingByIntake.entries()).map(([intakeCourseId, { name, count }]) => (
              <li key={intakeCourseId} className="flex items-center justify-between border-t border-border pt-3 admin-hover">
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
