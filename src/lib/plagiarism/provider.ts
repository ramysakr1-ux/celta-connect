// build-spec.md: "Designed to accept an external checker later. Build the
// scan as a provider interface, not as one hard-coded routine: a
// submission goes in, and a list of findings comes back... The built-in
// centre-archive check is simply the first provider." This file is that
// interface -- src/lib/plagiarism/builtin-provider.ts is today's only
// implementation.
import type { AssignmentTypeValue } from "@/lib/assignment-templates/content";

export type FieldType = "prose" | "analysis";
export type FindingSourceType = "same_course" | "cross_course_archive" | "brief" | "model_answer";

export interface ScanSection {
  sectionKey: string;
  fieldType: FieldType;
  text: string;
}

export interface ScanContext {
  assignmentId: string;
  round: "first" | "resubmission";
  centerId: string;
  courseId: string;
  assignmentType: AssignmentTypeValue;
  /** Concatenated known brief text (section instructions) -- must be
   * excluded from matching, or every submission matches every other
   * candidate on the same brief's own scaffolding. */
  briefText: string;
}

export interface ScanFinding {
  sectionKey: string;
  fieldType: FieldType;
  matchedText: string;
  matchLength: number;
  sourceType: FindingSourceType;
  sourceAssignmentId?: string;
  sourceCourseLabel?: string;
}

export interface PlagiarismScanProvider {
  name: string;
  scan(sections: ScanSection[], context: ScanContext): Promise<ScanFinding[]>;
}
