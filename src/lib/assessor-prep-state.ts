import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CentrePreparationItem } from "@/lib/assessor-requirements";

// What is actually ready, of the fifteen things Administration Handbook 14.1
// says a centre must give its assessor.
//
// Two kinds of item, and the difference matters:
//
//   DERIVED  -- Connect can answer honestly on its own. The course timetable
//               either has events or it does not; the Appian reference is
//               either set or it is not. These are never ticked by hand,
//               because a tick would let someone assert something the data
//               contradicts.
//   TICKED   -- only the centre knows. Whether the candidate agreements on
//               file are the current version, whether the application task is
//               compiled. Connect has no opinion, so it asks.
//
// Ramy, 6 Sep 2026: the MCT and Course Admin both tick, because half this list
// is Course Admin's work and the person who did it should be able to say so.

export type PrepStatus = "ready" | "missing" | "unticked" | "not_applicable";

export interface PrepItemState extends CentrePreparationItem {
  status: PrepStatus;
  /** True when Connect worked it out; false when a person said so. */
  derived: boolean;
  /** What Connect actually looked at, so a derived answer can be argued with. */
  evidence: string | null;
  markedByName: string | null;
  markedAt: string | null;
}

export interface PrepSummary {
  items: PrepItemState[];
  outstanding: PrepItemState[];
  readyCount: number;
  total: number;
}

/**
 * Everything the derivation needs, gathered by the caller so this stays a pure
 * function of already-fetched data -- the Assessor tab reads most of it
 * anyway, and a lib that re-queries would double the page's round trips.
 */
export interface PrepInputs {
  courseId: string;
  candidateCount: number;
  portfoliosComplete: number;
  hasTimetable: boolean;
  publishedAssignmentTitles: boolean;
  appianReference: string | null;
  previousReportOnFile: boolean;
  attendanceRegisterRows: number;
  lessonPlansForVisitDay: number;
  visitDayTeachingSlots: number;
  withdrawalLettersOutstanding: number;
  /** "11 Sept 2026 by Jordan Blake" once the Centre Grade form is marked submitted; null until then. */
  gradeFormSubmittedLabel: string | null;
}

function derive(key: string, i: PrepInputs): { status: PrepStatus; evidence: string } | null {
  switch (key) {
    case "portfolios":
      return i.candidateCount === 0
        ? { status: "missing", evidence: "No candidates on the course yet" }
        : {
            status: i.portfoliosComplete >= i.candidateCount ? "ready" : "missing",
            evidence: `${i.portfoliosComplete} of ${i.candidateCount} complete`,
          };
    case "course_timetable":
      return { status: i.hasTimetable ? "ready" : "missing", evidence: i.hasTimetable ? "Published on this course" : "No timetable events yet" };
    case "assignment_titles":
      return {
        status: i.publishedAssignmentTitles ? "ready" : "missing",
        evidence: i.publishedAssignmentTitles ? "Briefs published by this centre" : "No published briefs — the assessor sees Cambridge's titles only",
      };
    case "appian_reference":
      return {
        status: i.appianReference ? "ready" : "missing",
        evidence: i.appianReference ? `Set — ${i.appianReference}` : "Not set. Without it the assessor cannot open their report (§15.2)",
      };
    case "previous_report":
      return {
        status: i.previousReportOnFile ? "ready" : "missing",
        evidence: i.previousReportOnFile ? "Uploaded under centre documents" : "Not uploaded",
      };
    case "attendance_registers":
      return {
        status: i.attendanceRegisterRows > 0 ? "ready" : "missing",
        evidence: i.attendanceRegisterRows > 0 ? `${i.attendanceRegisterRows} attendance records` : "Nothing recorded yet",
      };
    case "lesson_plans":
      // 14.1 allows these to arrive at the start of the lesson, so a gap here
      // is a note rather than a failure.
      if (i.visitDayTeachingSlots === 0) return { status: "not_applicable", evidence: "Nobody is timetabled to teach on the visit day" };
      return {
        status: i.lessonPlansForVisitDay >= i.visitDayTeachingSlots ? "ready" : "unticked",
        evidence: `${i.lessonPlansForVisitDay} of ${i.visitDayTeachingSlots} plans in — 14.1 allows the rest at the start of the lesson`,
      };
    case "withdrawal_docs":
      return {
        status: i.withdrawalLettersOutstanding === 0 ? "ready" : "missing",
        evidence:
          i.withdrawalLettersOutstanding === 0
            ? "Letter generated for every withdrawal"
            : `${i.withdrawalLettersOutstanding} withdrawal letter${i.withdrawalLettersOutstanding === 1 ? "" : "s"} not generated`,
      };
    case "grade_form":
      // Derived from the tick rather than ticked here, so the person who
      // marked it and when is on the record (grade-form-actions.ts logs it).
      return {
        status: i.gradeFormSubmittedLabel ? "ready" : "missing",
        evidence: i.gradeFormSubmittedLabel
          ? `Marked submitted ${i.gradeFormSubmittedLabel}`
          : "Not yet marked as submitted -- the assessor's report cannot open until it is (§15.2)",
      };
    default:
      return null;
  }
}

export async function buildPrepSummary(
  supabase: SupabaseClient<Database>,
  items: CentrePreparationItem[],
  inputs: PrepInputs
): Promise<PrepSummary> {
  // Append-only: the newest row per item_key is the current answer.
  const { data: marks } = await supabase
    .from("assessor_prep_marks")
    .select("item_key, done, marked_by, created_at")
    .eq("course_id", inputs.courseId)
    .order("created_at", { ascending: false });

  const latest = new Map<string, { done: boolean; marked_by: string; created_at: string }>();
  for (const m of marks ?? []) if (!latest.has(m.item_key)) latest.set(m.item_key, m);

  const markerIds = [...new Set([...latest.values()].map((m) => m.marked_by))];
  const { data: people } =
    markerIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", markerIds) : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const resolved: PrepItemState[] = items.map((item) => {
    const d = derive(item.key, inputs);
    if (d) {
      return { ...item, status: d.status, derived: true, evidence: d.evidence, markedByName: null, markedAt: null };
    }
    const mark = latest.get(item.key);
    return {
      ...item,
      status: mark?.done ? "ready" : "unticked",
      derived: false,
      evidence: null,
      markedByName: mark ? (nameById.get(mark.marked_by) ?? "Someone at the centre") : null,
      markedAt: mark?.created_at ?? null,
    };
  });

  const counts = resolved.filter((r) => r.status !== "not_applicable");
  return {
    items: resolved,
    // What the warning lists. "unticked" and "missing" are both outstanding;
    // the difference is only whether a person or the data said so.
    outstanding: counts.filter((r) => r.status !== "ready"),
    readyCount: counts.filter((r) => r.status === "ready").length,
    total: counts.length,
  };
}
