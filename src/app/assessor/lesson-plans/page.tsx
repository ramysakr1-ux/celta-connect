import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { ASSESSOR_COOKIE, getAssessorCourseId, getAssessorTermsStatus, isAssessorPreview } from "@/lib/auth/portfolio-access";
import { AssessorReadOnlyBanner } from "@/components/assessor-readonly-banner";
import { halfOwningDate, halfTpDates, rotationPosition } from "@/lib/rotation";

const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(51% 0.017 70)";
const TEAL = "oklch(38% 0.072 195)";
const FAINT = "oklch(63% 0.012 82)";

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

// Ramy, 29 Aug 2026: "Lesson plans for the day takes the assessor to the
// timetable, and the timetable takes the assessor to the timetable." Both
// rows pointed at /trainer/timetable, so one of the six cohort documents
// was a duplicate of another. The Handbook lists them separately -- "the
// timetable" and "lesson plans for that day" are different documents, and
// the plans are the one the assessor actually reads before observing.
//
// The date-to-TP mapping is the rotation's, not a stored field: no table
// carries a date for a plan. The visit date belongs to one half (migration
// 0014's alternating TP days), that half's position in its own list of TP
// dates gives the TP number, and every member of that half teaches that
// number that day -- the same derivation the trainee's own Today card uses
// (portfolio/[traineeId]/today-tab.tsx).
export default async function AssessorLessonPlansPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get(ASSESSOR_COOKIE)?.value) redirect("/login");
  const termsStatus = await getAssessorTermsStatus();
  if (!termsStatus) redirect("/login?error=assessor_link_invalid");
  if (!termsStatus.accepted && !(await isAssessorPreview())) redirect("/assessor/gate");
  const courseId = await getAssessorCourseId();
  if (!courseId) redirect("/login?error=assessor_link_invalid");

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("name, assessor_visit_date")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) redirect("/login?error=assessor_link_invalid");

  const visitDate = course.assessor_visit_date;

  const { data: tpEvents } = visitDate
    ? await admin.from("course_timetable_events").select("event_date, event_time, title").eq("course_id", courseId).eq("type", "tp")
    : { data: null };

  const allTpEvents = tpEvents ?? [];
  const half = visitDate ? halfOwningDate(allTpEvents, visitDate) : null;
  const tpNumber = half && visitDate ? halfTpDates(allTpEvents, half).indexOf(visitDate) + 1 : 0;

  // Who teaches that TP number on that day, in the order they teach it.
  const { data: subgroups } = half
    ? await admin.from("course_subgroups").select("id, name").eq("course_id", courseId).eq("half_order", half)
    : { data: null };
  const subgroupIds = (subgroups ?? []).map((s) => s.id);
  const { data: members } = subgroupIds.length > 0
    ? await admin.from("course_subgroup_members").select("subgroup_id, trainee_id, base_slot").in("subgroup_id", subgroupIds)
    : { data: null };
  const traineeIds = (members ?? []).map((m) => m.trainee_id);
  const [{ data: people }, { data: plans }] = await Promise.all([
    traineeIds.length > 0
      ? admin.from("profiles").select("id, full_name").in("id", traineeIds)
      : Promise.resolve({ data: null }),
    traineeIds.length > 0 && tpNumber > 0
      ? admin
          .from("tp_plans")
          .select("trainee_id, main_aims, subsidiary_aims, class_profile, materials_description, framework_used, procedure, submitted_at")
          .eq("tp_number", tpNumber)
          .in("trainee_id", traineeIds)
      : Promise.resolve({ data: null }),
  ]);
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const planByTrainee = new Map((plans ?? []).map((p) => [p.trainee_id, p]));
  const subgroupSizeById = new Map(
    subgroupIds.map((id) => [id, (members ?? []).filter((m) => m.subgroup_id === id).length])
  );

  const teaching = (members ?? [])
    .map((m) => ({
      traineeId: m.trainee_id,
      name: nameById.get(m.trainee_id) ?? "Unknown",
      order: rotationPosition(m.base_slot, subgroupSizeById.get(m.subgroup_id) ?? 1, tpNumber) + 1,
      plan: planByTrainee.get(m.trainee_id) ?? null,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-background)" }}>
      <AssessorReadOnlyBanner subject="the course" />
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "34px 24px 60px" }}>
        <div className="frame" style={{ padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
            Assessor access — read-only · lesson plans for the day
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 26, fontWeight: 600, marginTop: 6, color: INK }}>
            {visitDate ? longDate(visitDate) : "Lesson plans for the visit"}
          </h1>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 8, maxWidth: 720, lineHeight: 1.6 }}>
            {visitDate && tpNumber > 0
              ? `The plans for the teaching practice you will observe on ${course.name} — TP ${tpNumber}, in teaching order.`
              : "The plans for the teaching practice you will observe, in teaching order."}
          </p>

          {!visitDate ? (
            <p className="card" style={{ marginTop: 26, padding: "18px 20px", fontSize: 13, color: FAINT }}>
              No assessor visit date has been set for this course yet, so there is no day to draw plans from. The main
              course tutor sets the date; the plans appear here once they do.
            </p>
          ) : tpNumber === 0 || teaching.length === 0 ? (
            <p className="card" style={{ marginTop: 26, padding: "18px 20px", fontSize: 13, color: FAINT }}>
              No teaching practice is timetabled for {longDate(visitDate)}, so there are no lesson plans for that day.
              The full course timetable is in the pack.
            </p>
          ) : (
            teaching.map((t, i) => (
              <div key={t.traineeId} className="card" style={{ marginTop: i === 0 ? 26 : 14, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: MUTED, flex: "none", fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {t.order}
                    </span>
                    <h2 style={{ fontFamily: "Georgia, serif", fontSize: 19, fontWeight: 600, color: INK }}>{t.name}</h2>
                  </div>
                  <Link
                    href={`/portfolio/${t.traineeId}/tp/${tpNumber}`}
                    className="hover:underline"
                    style={{ fontSize: 11.5, fontWeight: 600, color: TEAL, flex: "none", textDecoration: "none" }}
                  >
                    Open the full plan →
                  </Link>
                </div>

                {!t.plan ? (
                  <p style={{ fontSize: 12, color: FAINT, marginTop: 10 }}>No plan started for TP {tpNumber} yet.</p>
                ) : (
                  <>
                    {!t.plan.submitted_at ? (
                      <p style={{ fontSize: 11, color: FAINT, marginTop: 8 }}>Draft — not submitted yet.</p>
                    ) : null}
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      <PlanField label="Main aims" text={t.plan.main_aims} />
                      <PlanField label="Subsidiary aims" text={t.plan.subsidiary_aims} />
                      <PlanField label="Class profile" text={t.plan.class_profile} />
                      <PlanField label="Materials" text={t.plan.materials_description} />
                      <PlanField label="Framework" text={t.plan.framework_used} />
                    </div>
                    {Array.isArray(t.plan.procedure) && t.plan.procedure.length > 0 ? (
                      <p style={{ fontSize: 11, color: FAINT, marginTop: 10 }}>
                        {t.plan.procedure.length} stages in the procedure — in the full plan.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PlanField({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: MUTED }}>{label}</p>
      <p style={{ fontSize: 12.5, color: INK, marginTop: 3, lineHeight: 1.55, whiteSpace: "pre-line" }}>{text}</p>
    </div>
  );
}
