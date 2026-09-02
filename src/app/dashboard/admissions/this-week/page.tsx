import { BackLink } from "@/components/back-link";
import { requireAdmissionsHandler } from "@/lib/admissions-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBranchScope } from "@/lib/branch-scope";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { getCachedCenter } from "@/lib/supabase/cached-queries";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI"] as const;

// Pure date-string arithmetic (UTC-anchored Date construction, never local
// components) -- "this week" starts from todayIso, already resolved to the
// centre's own timezone by the caller, so nothing here needs to touch the
// server's own local clock again.
function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function mondayOfIso(todayIso: string): string {
  const [y, m, d] = todayIso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sun ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  return addDaysIso(todayIso, diff);
}

// Interview Booking.dc.html 1a, "This week's interviews" -- the staff grid
// view named in the design but never built (the availability generator and
// self-booking picker shipped without it). Real interview_slots for the
// current Mon-Fri, open and booked side by side, plus the same
// "no_interview_slots" flag the auto-triage/self-booking flow already
// writes to admissions_notifications -- this is that feed's first reader.
export default async function ThisWeeksInterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const staff = await requireAdmissionsHandler();
  // Branch-aware for the same reason as the Admissions landing: RLS resolves
  // "my centre" to one centre and cannot express "every branch I hold", so the
  // read goes through the admin client and every query carries the scope.
  const { branch } = await searchParams;
  const { scope } = await resolveBranchScope(staff, branch);
  const supabase = createAdminClient();

  const timeZone = (await getCachedCenter(staff.center_id))?.time_zone ?? DEFAULT_TIMEZONE;
  const weekStart = mondayOfIso(toLocalIso(new Date(), timeZone));
  const weekEnd = addDaysIso(weekStart, 4);

  const [{ data: slots }, { data: flagRows }] = await Promise.all([
    supabase
      .from("interview_slots")
      .select("id, slot_date, slot_time, mode, panel, interviewer_id, second_interviewer_id, booked_applicant_id")
      .in("center_id", scope)
      .gte("slot_date", weekStart)
      .lte("slot_date", weekEnd)
      .order("slot_date")
      .order("slot_time"),
    supabase
      .from("admissions_notifications")
      .select("applicant_id")
      .in("center_id", scope)
      .eq("type", "no_interview_slots")
      .is("read_at", null),
  ]);

  const profileIds = [
    ...new Set((slots ?? []).flatMap((s) => [s.interviewer_id, s.second_interviewer_id].filter((v): v is string => Boolean(v)))),
  ];
  const applicantIds = [...new Set((slots ?? []).map((s) => s.booked_applicant_id).filter((v): v is string => Boolean(v)))];
  const waitingApplicantIds = [...new Set((flagRows ?? []).map((f) => f.applicant_id))];

  const [{ data: profiles }, { data: bookedApplicants }, { data: waitingApplicants }] = await Promise.all([
    profileIds.length ? supabase.from("profiles").select("id, full_name").in("id", profileIds) : Promise.resolve({ data: [] }),
    applicantIds.length ? supabase.from("applicants").select("id, full_name").in("id", applicantIds) : Promise.resolve({ data: [] }),
    waitingApplicantIds.length
      ? supabase.from("applicants").select("id, full_name").in("id", waitingApplicantIds)
      : Promise.resolve({ data: [] }),
  ]);
  const nameByProfileId = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const nameByApplicantId = new Map((bookedApplicants ?? []).map((a) => [a.id, a.full_name]));

  const byDate = new Map<string, typeof slots>();
  for (const s of slots ?? []) {
    const list = byDate.get(s.slot_date) ?? [];
    list.push(s);
    byDate.set(s.slot_date, list);
  }

  const days = DAY_LABELS.map((label, i) => {
    const iso = addDaysIso(weekStart, i);
    return { label, date: iso, slots: byDate.get(iso) ?? [] };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <BackLink href="/dashboard/admissions" label="Admissions" />
        <h1 className="mt-2 font-serif text-xl text-ink">This week&apos;s interviews</h1>
        <p className="mt-1 text-sm text-muted">
          {weekStart} &ndash; {weekEnd}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        {days.map((d) => (
          <div key={d.date} className="flex flex-col gap-2">
            <div className="text-center text-xs font-bold text-muted">
              {d.label} <span className="font-normal">{d.date.slice(5)}</span>
            </div>
            {d.slots.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-border p-3 text-center text-xs text-muted">No slots</div>
            ) : (
              d.slots.map((s) => {
                const filled = Boolean(s.booked_applicant_id);
                return (
                  <div
                    key={s.id}
                    className={`flex flex-col gap-1 rounded-[8px] border p-3 admin-hover ${
                      filled ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <div className={`text-xs font-bold ${filled ? "text-primary" : "text-muted"}`}>
                      {s.slot_time.slice(0, 5)} · {s.mode === "online" ? "Online" : "In person"}
                    </div>
                    {filled ? (
                      <>
                        <div className="text-sm font-semibold text-ink">
                          {nameByApplicantId.get(s.booked_applicant_id!) ?? "Booked"}
                        </div>
                        <div className="text-xs text-muted">
                          {nameByProfileId.get(s.interviewer_id) ?? "Unknown interviewer"}
                        </div>
                        {s.panel ? (
                          <div className="text-[10px] font-bold text-muted">
                            Panel -- 2 interviewers
                            {s.second_interviewer_id ? ` (${nameByProfileId.get(s.second_interviewer_id) ?? "second"})` : ""}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-xs italic text-muted">Open</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>

      {waitingApplicants && waitingApplicants.length > 0 ? (
        <div className="card flex items-start gap-3 border-destructive/30 bg-destructive/5 p-4">
          <div className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-destructive" />
          <p className="text-sm text-ink">
            {waitingApplicants.length} applicant{waitingApplicants.length === 1 ? "" : "s"} waiting, no slots open
            {waitingApplicants.length <= 3 ? ` (${waitingApplicants.map((a) => a.full_name).join(", ")})` : ""}. Each holds an
            honest email: &quot;we would like to meet you, we are finding a time, we will write within two working days.&quot;
            Flag clears when a slot is added.
          </p>
        </div>
      ) : null}
    </div>
  );
}
