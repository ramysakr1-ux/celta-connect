import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBuiltInProvider } from "@/lib/plagiarism/builtin-provider";
import { shingleSet } from "@/lib/plagiarism/text-match";
import type { ScanSection } from "@/lib/plagiarism/provider";

// Runs after a trainee's submission succeeds (submit_assignment_round).
// Uses the admin client deliberately: a scan has to read every other
// trainee's submissions on this course plus the centre's cross-course
// archive, both well outside the submitting trainee's own RLS scope --
// this is the one place in the app that's true for, matching the same
// reasoning as the assessor token-link admin-client usage elsewhere.
export async function runPlagiarismScan(assignmentId: string, round: "first" | "resubmission"): Promise<void> {
  const supabase = createAdminClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("course_id, assignment_type")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return;

  const { data: course } = await supabase
    .from("courses")
    .select("center_id, name, end_date")
    .eq("id", assignment.course_id)
    .maybeSingle();
  if (!course) return;

  const { data: template } = await supabase
    .from("assignment_templates")
    .select("sections, format")
    .eq("center_id", course.center_id)
    .eq("assignment_type", assignment.assignment_type)
    .not("published_at", "is", null)
    .maybeSingle();
  // No published brief means no known scaffolding to exclude and no
  // section list to scan against -- nothing to do yet.
  if (!template) return;

  const fieldType = template.format === "prose" ? "prose" : "analysis";
  const briefText = template.sections.map((s) => s.instruction).join("\n");

  const { data: responses } = await supabase
    .from("assignment_section_responses")
    .select("section_key, first_response, resubmission_response")
    .eq("assignment_id", assignmentId);

  const sections: ScanSection[] = (responses ?? [])
    .map((r) => ({
      sectionKey: r.section_key,
      fieldType: fieldType as "prose" | "analysis",
      text: (round === "resubmission" ? r.resubmission_response : r.first_response) ?? "",
    }))
    .filter((s) => s.text.trim().length > 0);
  if (sections.length === 0) return;

  const provider = createBuiltInProvider(supabase);
  const findings = await provider.scan(sections, {
    assignmentId,
    round,
    centerId: course.center_id,
    courseId: assignment.course_id,
    assignmentType: assignment.assignment_type,
    briefText,
  });

  if (findings.length > 0) {
    await supabase.from("plagiarism_scanner_findings").insert(
      findings.map((f) => ({
        assignment_id: assignmentId,
        round,
        section_key: f.sectionKey,
        field_type: f.fieldType,
        matched_text: f.matchedText,
        match_length: f.matchLength,
        source_type: f.sourceType,
        source_assignment_id: f.sourceAssignmentId ?? null,
        source_course_label: f.sourceCourseLabel ?? null,
        provider: "built_in",
      }))
    );
  }

  // Append this submission's own fingerprints to the archive so FUTURE
  // submissions (this course or a later one) can match against it. Never
  // the brief's own text -- otherwise every future submission on this
  // brief would match the brief's own fingerprint here too.
  const courseLabel = `${course.name} (${course.end_date})`;
  const fingerprintRows = sections.map((s) => ({
    center_id: course.center_id,
    course_id: assignment.course_id,
    course_label: courseLabel,
    assignment_type: assignment.assignment_type,
    section_key: s.sectionKey,
    field_type: s.fieldType,
    shingles: shingleSet(s.text),
    source_assignment_id: assignmentId,
  }));
  if (fingerprintRows.length > 0) {
    await supabase.from("submission_text_fingerprints").insert(fingerprintRows);
  }
}
