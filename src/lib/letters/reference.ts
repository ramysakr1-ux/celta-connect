import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";
import type { FeedbackPoint } from "@/lib/tp-plan-content";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";

// for-claude-code-reference-letter.md: "generated from their actual record
// on the course... not a fill-in-the-blanks generic template." Available
// once the course has closed and a final grade is set -- same compound
// gate the final-report route already uses (trainer_signoff_final_at set,
// grade not one of the three non-outcomes), so "closed" here means the
// tutor has genuinely finalized the record, not that course_close_outs has
// reached any particular status.
const NON_OUTCOME_GRADES = new Set(["Withdrawn", "Extension", "Deferred"]);

export function isReferenceLetterEligible(record: {
  final_recommended_grade: string | null;
  trainer_signoff_final_at: string | null;
}): boolean {
  return Boolean(
    record.trainer_signoff_final_at &&
      record.final_recommended_grade &&
      !NON_OUTCOME_GRADES.has(record.final_recommended_grade)
  );
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const codesOf = (points: FeedbackPoint[]): string[] => points.flatMap((p) => p.criteria_codes);

export interface ReferenceLetterDraft {
  input: FormalLetterInput;
  facts: { candidateName: string; courseId: string; traineeId: string };
}

// Mirrors buildFailRiskDraft's shape (src/lib/letters/fail-risk.ts): a pure
// read of real data into the shared FormalLetterInput template, left for a
// human to edit before issuing -- see letter-issue-form.tsx, which now also
// exposes `body` for editing (previously fixed), since a reference letter
// is nearly all prose rather than a facts+list notice.
export async function buildReferenceLetterDraft(
  supabase: SupabaseClient<Database>,
  courseId: string,
  traineeId: string,
  issuedByName: string
): Promise<ReferenceLetterDraft | null> {
  const [{ data: trainee }, { data: course }, { data: record }, { data: tpFeedbackRows }, { data: folClaims }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", traineeId).maybeSingle(),
    supabase.from("courses").select("name, start_date, end_date, center_id, total_hours").eq("id", courseId).maybeSingle(),
    supabase
      .from("celta5_records")
      .select("final_recommended_grade, hours_attended, overall_notes, trainer_signoff_final_at")
      .eq("trainee_id", traineeId)
      .maybeSingle(),
    supabase
      .from("tp_feedback")
      .select("strengths_planning, strengths_teaching")
      .eq("trainee_id", traineeId)
      .not("submitted_at", "is", null),
    supabase.from("fol_claims").select("id").eq("candidate_id", traineeId),
  ]);
  if (!trainee || !course || !record) return null;
  if (!isReferenceLetterEligible(record)) return null;

  const { data: center } = await supabase.from("centers").select("name, center_number").eq("id", course.center_id).maybeSingle();
  const { data: mct } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("course_id", courseId)
    .eq("tutor_role", "main_course_tutor")
    .maybeSingle();

  // Recurring strengths -- the mirror of computeAtRiskReasons' Stream 3
  // (src/lib/at-risk.ts), but over strengths instead of action points: a
  // criterion counted once per TP it appears as a strength in, kept when it
  // shows up on 2+ TPs so this reads as a genuine pattern, not one lesson's
  // passing comment.
  const strengthTpsByCode = new Map<string, number>();
  for (const f of tpFeedbackRows ?? []) {
    const codes = new Set(codesOf([...(f.strengths_planning ?? []), ...(f.strengths_teaching ?? [])]));
    for (const code of codes) strengthTpsByCode.set(code, (strengthTpsByCode.get(code) ?? 0) + 1);
  }
  const recurringStrengths = [...strengthTpsByCode.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => CRITERIA_LABELS[code] ?? code);

  const firstName = trainee.full_name.split(" ")[0];
  const attendanceLine =
    record.hours_attended != null
      ? `${trainee.full_name} attended ${record.hours_attended} of the course's ${course.total_hours} contact hours.`
      : null;
  const folLine = (folClaims ?? []).length > 0 ? `${firstName} engaged actively with the course's Focus on Learner evidence gathering.` : null;

  const today = new Date().toISOString().slice(0, 10);

  const body: string[] = [
    `To whom it may concern,`,
    `I am writing to provide a reference for ${trainee.full_name}, who completed the CELTA (Certificate in English Language Teaching to Adults) course at ${center?.name ?? "our centre"} from ${formatDate(course.start_date)} to ${formatDate(course.end_date)}, achieving a final grade of ${record.final_recommended_grade}.`,
    [attendanceLine, folLine].filter(Boolean).join(" ") ||
      `${firstName} completed the course's full programme of teaching practice, input sessions, and written assignments.`,
    record.overall_notes ? record.overall_notes : `${firstName} showed steady development across the course, building genuine confidence and competence in the classroom.`,
  ].filter(Boolean);

  return {
    input: {
      centerName: center?.name ?? "Your centre",
      centerSubtitle: `Cambridge CELTA centre${center?.center_number ? ` · ${center.center_number}` : ""}`,
      centerLogoUrl: null,
      kicker: "Reference letter",
      docTitle: `Reference for ${trainee.full_name}`,
      dateLabel: formatDate(today),
      dayLine: null,
      facts: [
        { label: "Candidate", value: trainee.full_name },
        { label: "Course", value: `${course.name} (${formatDate(course.start_date)} – ${formatDate(course.end_date)})` },
        { label: "Grade", value: record.final_recommended_grade ?? "--" },
        { label: "Main tutor", value: mct?.full_name ?? issuedByName },
      ],
      body,
      list:
        recurringStrengths.length > 0
          ? { title: "Areas of particular strength", items: recurringStrengths }
          : undefined,
      closing: `I recommend ${trainee.full_name} without reservation and am happy to be contacted directly for any further information.`,
      signatures: [{ label: mct?.full_name === issuedByName ? "Main course tutor" : "Course tutor", value: `${issuedByName} · ${formatDate(today)}`, filled: true }],
      filedNote: `Filed with ${trainee.full_name}'s CELTA 5 record · exported with the course at close-out. This is ${center?.name ?? "the centre"}'s document; Connect produced it and does not appear on it.`,
    },
    facts: { candidateName: trainee.full_name, courseId, traineeId },
  };
}
