import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAssignmentRegister } from "@/lib/openai/read-assignment-register";

// connect-build-specs-5-gaps-2026-08-21.md item 1 / connect-decision-
// language-precheck.md: runs right after a trainee's submission succeeds
// (submit_assignment_round), same "never blocks what already succeeded"
// shape as runPlagiarismScan -- a scan failure here must never undo a
// real submission. Admin client for the same reason plagiarism scan uses
// it: nothing here is scoped to the submitting trainee's own RLS.
export async function runLanguagePrecheck(assignmentId: string, round: "first" | "resubmission"): Promise<void> {
  const supabase = createAdminClient();

  const { data: responses } = await supabase
    .from("assignment_section_responses")
    .select("first_response, resubmission_response")
    .eq("assignment_id", assignmentId);
  if (!responses) return;

  const fullText = responses
    .map((r) => (round === "resubmission" ? r.resubmission_response : r.first_response) ?? "")
    .filter((t) => t.trim())
    .join("\n\n");
  if (!fullText.trim()) return;

  const reading = await readAssignmentRegister(fullText);
  if (!reading) return;

  const note = reading.flagged ? reading.note : null;
  if (round === "resubmission") {
    await supabase.from("assignments").update({ resubmission_register_note: note }).eq("id", assignmentId);
  } else {
    await supabase.from("assignments").update({ first_register_note: note }).eq("id", assignmentId);
  }
}
