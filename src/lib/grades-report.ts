import "server-only";
import { resolveProvisionalDeadline } from "@/lib/provisional-deadline";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSignatureLedger, isBookletExportReady } from "@/lib/celta5-signatures";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import { mapTpFeedbackToGlyphRow } from "@/lib/tp-grades";
import type { CohortSheetRow } from "@/app/trainer/(hub)/grades-report/cohort-sheet";
import type { Database } from "@/lib/supabase/types";

type Celta5Record = Database["public"]["Tables"]["celta5_records"]["Row"];

// Shared by the Grades Report page and its CSV export (Grades Report.dc.html
// 1a's "Export report" action) -- one cohort-row computation, not two copies
// that can drift. Page-only concerns (matrix ratings, per-candidate detail)
// stay in page.tsx; this is only what CohortSheetRow needs.
export async function computeCohortRows(
  supabase: SupabaseClient<Database>,
  courseId: string,
  /**
   * An assessor sees only what the centre has stood behind. Ramy, 30 Aug
   * 2026, on the cohort sheet: the MCT "has to send the provisional report
   * to the assessor -- we'll put it in the pack, and then we'll send the
   * link." His design says the same, and says the send is a commitment:
   * "sent to the assessor -- locked. Changing the provisional grade now
   * needs a new note to the assessor, not a silent edit."
   *
   * Nothing enforced that. A tutor's unapproved draft grade, and their
   * working note, were visible to the assessor the moment they were typed.
   * With this on, an unapproved candidate reads "Not yet sent" instead.
   */
  opts?: { approvedOnly?: boolean }
): Promise<{
  courseName: string;
  provisionalDueAt: string | null;
  /** True when no one set a date and the rule derived it from the visit. */
  provisionalDueDerived: boolean;
  rows: CohortSheetRow[];
}> {
  const { data: course } = await supabase
    .from("courses")
    .select("name, provisional_grades_due_at, assessor_visit_date")
    .eq("id", courseId)
    .maybeSingle();

  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  const [{ data: records }, { data: tpFeedbackRows }, { data: assignments }, { data: planAssignments }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase.from("celta5_records").select("*").eq("course_id", courseId),
          supabase.from("tp_feedback").select("trainee_id, tp_number, grade, submitted_at").in("trainee_id", traineeIds),
          supabase.from("assignments").select("*").in("trainee_id", traineeIds),
          supabase.from("plan_assignments").select("trainee_id, tp_point_id, taught_at").eq("course_id", courseId),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const recordByTrainee = new Map((records ?? []).map((r) => [r.trainee_id, r]));

  const approvedOnly = opts?.approvedOnly ?? false;

  function provisionalLabel(record: Celta5Record | null | undefined): string {
    if (!record?.provisional_grade) return "Not set";
    // Deliberately not "Not set": the difference between a grade nobody has
    // proposed and one the MCT hasn't released yet matters to an assessor
    // reading the sheet before the deadline.
    if (approvedOnly && !record.provisional_approved_at) return "Not yet confirmed";
    return record.provisional_grade_upper ? `${record.provisional_grade} / ${record.provisional_grade_upper}` : record.provisional_grade;
  }

  const rows: CohortSheetRow[] = (trainees ?? []).map((trainee) => {
    const record = recordByTrainee.get(trainee.id) ?? null;
    const traineeAssignments = (assignments ?? []).filter((a) => a.trainee_id === trainee.id);
    const traineeFeedback = (tpFeedbackRows ?? []).filter((f) => f.trainee_id === trainee.id);
    const taughtForTrainee = (planAssignments ?? []).filter((p) => p.trainee_id === trainee.id && p.taught_at).length;

    let outstanding = "";
    if (!record) {
      outstanding = "No CELTA 5 record";
    } else if (record.stage3_tutorial_required && !record.stage3_finalized_at) {
      outstanding = "Stage 3 record open";
    } else {
      const unresolved = traineeAssignments.find((a) => {
        const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
        const status = isResubmissionRound ? a.resubmission_status : a.first_status;
        return status !== "approved";
      });
      if (unresolved) {
        outstanding = `${ASSIGNMENT_INFO[unresolved.assignment_type]?.title ?? unresolved.assignment_type} unresolved`;
      } else {
        const ledger = computeSignatureLedger(record, traineeAssignments);
        if (!isBookletExportReady(ledger)) {
          const outstandingCount = ledger.filter((r) => r.state !== "signed").length;
          outstanding = `${outstandingCount} signature${outstandingCount === 1 ? "" : "s"} outstanding`;
        }
      }
    }

    return {
      traineeId: trainee.id,
      name: trainee.full_name,
      tpGlyphs: mapTpFeedbackToGlyphRow(traineeFeedback),
      provisionalLabel: provisionalLabel(record),
      recommendedGrade: record?.final_recommended_grade ?? null,
      outstanding,
      wasSlashed: Boolean(record?.provisional_grade_upper),
      justified: Boolean(record?.overall_notes),
      stage3Status: !record?.stage3_tutorial_required ? "not_required" : record.stage3_finalized_at ? "given" : "not_given",
      tpsRemaining: Math.max(8 - taughtForTrainee, 0),
      hasProvisional: Boolean(record?.provisional_grade) && (!approvedOnly || Boolean(record?.provisional_approved_at)),
      provisionalApproved: Boolean(record?.provisional_approved_at),
    };
  });

  // The design's rule -- two days before the visit, pulled back to the Friday
  // when that falls at a weekend -- rather than leaving it blank because
  // nobody typed a date. An MCT-set date still wins. See
  // src/lib/provisional-deadline.ts.
  const deadline = resolveProvisionalDeadline(
    course?.provisional_grades_due_at ?? null,
    course?.assessor_visit_date ?? null
  );

  return {
    courseName: course?.name ?? "Course",
    provisionalDueAt: deadline.dueDate,
    provisionalDueDerived: deadline.derived,
    rows,
  };
}
