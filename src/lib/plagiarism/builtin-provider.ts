import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  findMatchedRuns,
  findMatchedRunsAgainstShingleSet,
  briefShingleKeys,
  MATCH_THRESHOLD,
} from "@/lib/plagiarism/text-match";
import type { PlagiarismScanProvider, ScanContext, ScanFinding, ScanSection } from "@/lib/plagiarism/provider";

// build-spec.md "Plagiarism scanner": compares against this course, the
// centre's cross-course archive, and the brief (subtracted, never
// reported as a finding). No model-answer comparison yet -- there's no
// storage for model answers anywhere in the app today, so that source
// listed in the spec is a gap for whenever that exists, not silently
// faked here.
export function createBuiltInProvider(supabase: SupabaseClient<Database>): PlagiarismScanProvider {
  return {
    name: "built_in",
    async scan(sections: ScanSection[], context: ScanContext): Promise<ScanFinding[]> {
      const excludeShingleKeys = briefShingleKeys(context.briefText);
      const findings: ScanFinding[] = [];

      // Same-course: every other assignment of this type on this course,
      // whichever round they last wrote (their most recent response per
      // section).
      const { data: sameCourseAssignments } = await supabase
        .from("assignments")
        .select("id")
        .eq("course_id", context.courseId)
        .eq("assignment_type", context.assignmentType)
        .neq("id", context.assignmentId);

      const sameCourseIds = (sameCourseAssignments ?? []).map((a) => a.id);
      const { data: sameCourseResponses } =
        sameCourseIds.length > 0
          ? await supabase
              .from("assignment_section_responses")
              .select("assignment_id, section_key, first_response, resubmission_response")
              .in("assignment_id", sameCourseIds)
          : { data: [] };

      for (const section of sections) {
        if (!section.text.trim()) continue;

        for (const other of sameCourseResponses ?? []) {
          if (other.section_key !== section.sectionKey) continue;
          const otherText = other.resubmission_response || other.first_response;
          if (!otherText) continue;
          const runs = findMatchedRuns(section.text, otherText, section.fieldType, excludeShingleKeys);
          for (const run of runs) {
            findings.push({
              sectionKey: section.sectionKey,
              fieldType: section.fieldType,
              matchedText: run.text,
              matchLength: run.length,
              sourceType: "same_course",
              sourceAssignmentId: other.assignment_id,
            });
          }
        }
      }

      // Cross-course archive, this centre only, excluding this course.
      const { data: archiveRows } = await supabase
        .from("submission_text_fingerprints")
        .select("course_id, course_label, section_key, field_type, shingles")
        .eq("center_id", context.centerId)
        .eq("assignment_type", context.assignmentType)
        .neq("course_id", context.courseId);

      for (const section of sections) {
        if (!section.text.trim()) continue;
        for (const archived of archiveRows ?? []) {
          if (archived.section_key !== section.sectionKey) continue;
          const runs = findMatchedRunsAgainstShingleSet(
            section.text,
            new Set(archived.shingles),
            section.fieldType,
            excludeShingleKeys
          );
          for (const run of runs) {
            findings.push({
              sectionKey: section.sectionKey,
              fieldType: section.fieldType,
              matchedText: run.text,
              matchLength: run.length,
              sourceType: "cross_course_archive",
              sourceCourseLabel: archived.course_label,
            });
          }
        }
      }

      return findings;
    },
  };
}

export { MATCH_THRESHOLD };
