import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ASSIGNMENT_CRITERIA } from "@/lib/assignment-criteria";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import type { FormalLetterInput } from "@/lib/formal-letter-pdf/document";

type Assignment = Database["public"]["Tables"]["assignments"]["Row"];

// Letters.dc.html 1b: "Any assignment reaching a Fail outcome -- that is,
// failing after its one resubmission." Matches the cover sheet's own
// four-outcome model (migration 0049): only resubmission_outcome='fail' is
// terminal-fail: first_status='resubmission_required' alone just means a
// resubmission is still owed, not a fail yet.
export function isAssignmentWarningTriggered(assignment: Assignment): boolean {
  return assignment.resubmission_status === "approved" && assignment.resubmission_outcome === "fail";
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export interface AssignmentWarningDraft {
  input: FormalLetterInput;
  facts: { candidateName: string; courseId: string; traineeId: string };
}

export async function buildAssignmentWarningDraft(
  supabase: SupabaseClient<Database>,
  courseId: string,
  assignmentId: string,
  issuedByName: string
): Promise<AssignmentWarningDraft | null> {
  const { data: assignment } = await supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (!assignment || !isAssignmentWarningTriggered(assignment)) return null;

  const [{ data: trainee }, { data: course }, { data: allAssignments }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", assignment.trainee_id).maybeSingle(),
    supabase.from("courses").select("name, start_date, end_date, center_id").eq("id", courseId).maybeSingle(),
    supabase.from("assignments").select("*").eq("trainee_id", assignment.trainee_id),
  ]);
  if (!trainee || !course) return null;

  const { data: center } = await supabase.from("centers").select("name, center_number").eq("id", course.center_id).maybeSingle();
  const { data: markers } =
    assignment.marker_id || assignment.second_marker_id
      ? await supabase.from("profiles").select("id, full_name").in("id", [assignment.marker_id, assignment.second_marker_id].filter((v): v is string => !!v))
      : { data: [] };
  const markerName = (id: string | null) => (id ? (markers ?? []).find((m) => m.id === id)?.full_name ?? "Unknown" : null);

  const passed = (allAssignments ?? []).filter((a) => a.first_status === "approved" || a.resubmission_outcome === "pass").length;
  const failed = (allAssignments ?? []).filter((a) => a.resubmission_outcome === "fail").length;
  const remaining = (allAssignments ?? []).filter((a) => a.first_status === "approved" || a.resubmission_outcome === "pass" || a.resubmission_outcome === "fail" ? false : true);

  const criteria = ASSIGNMENT_CRITERIA[assignment.assignment_type] ?? [];
  const marks = (assignment.resubmission_criteria_marks as Record<string, boolean>) ?? {};
  const notMet = criteria.filter((c) => marks[c.key] !== true).map((c) => c.text);

  const today = new Date().toISOString().slice(0, 10);
  const assignmentTitle = ASSIGNMENT_INFO[assignment.assignment_type]?.title ?? assignment.assignment_type;

  const input: FormalLetterInput = {
    centerName: center?.name ?? "Your centre",
    centerSubtitle: `Cambridge CELTA centre${center?.center_number ? ` · ${center.center_number}` : ""}`,
    centerLogoUrl: null,
    kicker: "Formal notice · written assignments",
    docTitle: "Notice following a failed assignment",
    dateLabel: formatDate(today),
    dayLine: null,
    facts: [
      { label: "Candidate", value: trainee.full_name },
      { label: "Course", value: `${course.name} (${formatDate(course.start_date)} – ${formatDate(course.end_date)})` },
      { label: "Assignment", value: `${assignment.assignment_type} · ${assignmentTitle}` },
      { label: "Outcome", value: "Fail on resubmission" },
    ],
    body: [
      `Dear ${trainee.full_name.split(" ")[0]},`,
      `Your resubmission of ${assignment.assignment_type}, ${assignmentTitle}, has not met the assessment criteria. As you have already used the one resubmission available for that assignment, it is recorded as a Fail.`,
      `A candidate must pass three of the four written assignments to be eligible for a Pass on this course. You have passed ${passed}${failed > 0 ? ` and failed ${failed}` : ""}, with ${remaining.length} still to submit. This means you cannot fail another assignment.`,
    ],
    list: { title: "Criteria not met on the resubmission", items: notMet },
    closing:
      remaining.length > 0
        ? `${remaining.map((a) => `${ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type}${a.due_date ? ` (due ${formatDate(a.due_date)})` : ""}`).join(" and ")} still need${remaining.length === 1 ? "s" : ""} to pass. Please talk to your tutor before you submit.`
        : "Please talk to your tutor as soon as possible.",
    // Assessing tutor, MCT, and the candidate's acknowledgement -- three
    // signatures here too, per the source design's own rule: "the same
    // rule as the Fail letter, because both change what the rest of the
    // course means."
    signatures: [
      { label: "Course tutor", value: `${issuedByName} · ${formatDate(today)}`, filled: true },
      { label: "Marker", value: markerName(assignment.marker_id) ?? "Not recorded", filled: Boolean(markerName(assignment.marker_id)) },
      { label: "Received by candidate", value: "Awaiting acknowledgement", filled: false },
    ],
    filedNote: `Filed in CELTA 5 Section A · attached to the assignment record · visible to the assessor. This is ${center?.name ?? "the centre"}'s document; Connect produced it and does not appear on it.`,
  };

  return { input, facts: { candidateName: trainee.full_name, courseId, traineeId: assignment.trainee_id } };
}
