import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseStatus, Database } from "@/lib/supabase/types";
import { computeAssessedTpStats } from "@/lib/course-progress";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

// Handbook 12.1.3: "The candidate portfolios should be up-to-date on the day
// of the assessment." Up to date, not finished -- the visit is mid-course
// and an assignment whose deadline falls after it is not a gap in anyone's
// portfolio. Until 12 Sep 2026 the readiness bar counted every unmarked
// assignment, so a course whose Lessons from the Classroom was due three
// days after the visit read "0 of 11 complete" and "LfC unresolved (11
// candidates)" -- Ramy: "why are we doing the assessor visit again?"
//
// The cutoff is the visit date where one is set, otherwise today in the
// centre's zone. Work due ON the visit day is handed in that morning and
// cannot be marked for the assessor to moderate, so only work due BEFORE
// the day is expected marked; an assignment with no deadline still counts.
async function assignmentCutoff(supabase: SupabaseClient<Database>, courseId: string): Promise<string> {
  const { data: course } = await supabase.from("courses").select("assessor_visit_date, center_id").eq("id", courseId).maybeSingle();
  if (course?.assessor_visit_date) return course.assessor_visit_date;
  const timeZone = course?.center_id ? ((await getCachedCenter(course.center_id))?.time_zone ?? DEFAULT_TIMEZONE) : DEFAULT_TIMEZONE;
  return toLocalIso(new Date(), timeZone);
}

function dueByCutoff(a: { due_date: string | null }, cutoff: string): boolean {
  return !a.due_date || a.due_date < cutoff;
}

export interface ReadinessIssue {
  traineeId: string;
  traineeName: string;
  reason: string;
}

export interface AssessorReadiness {
  ready: boolean;
  issues: ReadinessIssue[];
  totalCandidates: number;
  portfoliosCompleteCount: number;
  hoursAssessedTotal: number;
  gradesEnteredCount: number;
  // Grade Pipeline handoff: what actually gates sending to the assessor is
  // MCT approval, not just a tutor having proposed a value.
  gradesApprovedCount: number;
}

// for-claude-code-assessor-interface.md: "before it runs, it must check the
// pack is actually complete and name what isn't (an unrated criterion, an
// unresolved assignment, an open Stage 3, a missing signature) -- it should
// refuse quietly rather than export a gap." This is a NARROWER bar than
// close-out's isBookletExportReady() (celta5-signatures.ts) -- that one
// also requires the final-grade signatures, which don't exist yet at
// assessor-visit time (the visit happens mid-course). "Unrated criterion"
// and "missing signature" both collapse into one check here: Stage 2
// review + candidate sign-off completed, since both are symptoms of the
// same underlying gap (the Stage 2 grid pass isn't finished).
export async function computeAssessorReadiness(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<AssessorReadiness> {
  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .eq("course_status", "active");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  if (traineeIds.length === 0) {
    return { ready: true, issues: [], totalCandidates: 0, portfoliosCompleteCount: 0, hoursAssessedTotal: 0, gradesEnteredCount: 0, gradesApprovedCount: 0 };
  }

  const [{ data: records }, { data: assignments }, { data: planAssignments }, cutoff] = await Promise.all([
    supabase.from("celta5_records").select("*").eq("course_id", courseId),
    supabase.from("assignments").select("*").in("trainee_id", traineeIds),
    supabase.from("plan_assignments").select("trainee_id, tp_point_id, taught_at").eq("course_id", courseId),
    assignmentCutoff(supabase, courseId),
  ]);

  // Perf, 6 Sep 2026: these two were `select(...)` with NO filter at all --
  // every TP point and every coursebook on the PLATFORM, fetched twice per
  // assessor page load (once here, once in buildCandidateCards) and
  // sequentially at that. Small today, but it grows with every centre that
  // ever joins rather than with this course, which is the shape of a page
  // that quietly gets slower over months.
  //
  // Only the points this course actually taught are needed -- the pair of
  // maps exists to turn a taught tp_point_id into its coursebook's level --
  // so both are now bounded by the course instead of by the platform. Still
  // two round trips, but two small ones that stay small.
  const usedPointIds = [...new Set((planAssignments ?? []).map((p) => p.tp_point_id).filter((x): x is string => Boolean(x)))];
  const { data: tpPoints } = usedPointIds.length
    ? await supabase.from("tp_points").select("id, tp_coursebook_id").in("id", usedPointIds)
    : { data: [] };
  const tpPointCoursebookById = new Map((tpPoints ?? []).map((p) => [p.id, p.tp_coursebook_id]));
  const usedBookIds = [...new Set([...tpPointCoursebookById.values()].filter((x): x is string => Boolean(x)))];
  const { data: coursebooks } = usedBookIds.length ? await supabase.from("tp_coursebooks").select("id, level").in("id", usedBookIds) : { data: [] };
  const coursebookLevelById = new Map((coursebooks ?? []).map((c) => [c.id, c.level]));

  const recordByTrainee = new Map((records ?? []).map((r) => [r.trainee_id, r]));

  const issues: ReadinessIssue[] = [];
  let portfoliosCompleteCount = 0;
  let hoursAssessedTotal = 0;
  let gradesEnteredCount = 0;
  let gradesApprovedCount = 0;

  for (const trainee of trainees ?? []) {
    const record = recordByTrainee.get(trainee.id);
    const traineeAssignments = (assignments ?? []).filter((a) => a.trainee_id === trainee.id);
    const taughtAssignments = (planAssignments ?? []).filter((p) => p.trainee_id === trainee.id && p.taught_at);
    const assessedTp = computeAssessedTpStats({ taughtAssignments, tpPointCoursebookById, coursebookLevelById });
    hoursAssessedTotal += assessedTp.hoursAssessed;
    if (record?.provisional_grade) gradesEnteredCount += 1;
    if (record?.provisional_approved_at) gradesApprovedCount += 1;

    let complete = true;

    if (!record?.stage2_completed_at || !record?.trainee_signoff_stage2_at) {
      issues.push({ traineeId: trainee.id, traineeName: trainee.full_name, reason: "Stage 2 record not signed off" });
      complete = false;
    }

    const unresolved = traineeAssignments.find((a) => {
      if (!dueByCutoff(a, cutoff)) return false; // not yet due on the visit day -- not a gap (12.1.3)
      const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
      const status = isResubmissionRound ? a.resubmission_status : a.first_status;
      return status !== "approved";
    });
    if (unresolved) {
      issues.push({
        traineeId: trainee.id,
        traineeName: trainee.full_name,
        reason: `${unresolved.assignment_type} unresolved`,
      });
      complete = false;
    }

    if (record?.stage3_tutorial_required && !record.stage3_finalized_at) {
      issues.push({ traineeId: trainee.id, traineeName: trainee.full_name, reason: "Stage 3 record still open" });
      complete = false;
    }

    if (complete) portfoliosCompleteCount += 1;
  }

  return {
    ready: issues.length === 0,
    issues,
    totalCandidates: (trainees ?? []).length,
    portfoliosCompleteCount,
    hoursAssessedTotal,
    gradesEnteredCount,
    gradesApprovedCount,
  };
}

export interface CandidateCardData {
  traineeId: string;
  name: string;
  tpsTaught: number;
  hoursAssessed: number;
  levels: string[];
  provisionalLabel: string | null;
  celta5Complete: boolean;
  // What celta5Complete actually turned on, in words. Ramy, 29 Aug 2026:
  // "can't see the CELTA 5 incomplete. Not sure what that means." The
  // assessor drawer described this flag as "criteria or tutor comments
  // still outstanding", which is not what it measures -- it is the Stage
  // Two completion and candidate sign-off (plus Stage Three where one is
  // required). The card's own flaggedIssue already said "Stage 2 record
  // still open" correctly; this puts the same honesty in the drawer, and
  // names which of the three conditions is the open one.
  celta5Detail: string;
  tpsComplete: boolean;
  assignmentsComplete: boolean;
  flaggedIssue: string | null;
  // for-claude-code-assessor-pack-decisions.md §1
  selectedForAssessorVisit: boolean;
  // Added for the MCT Assessor tab's candidate wall (assessor-wall.ts): it
  // groups by these as well, and names the group so a card can be tied to the
  // visit day's schedule. Additive only -- /assessor ignores all three.
  courseStatus: CourseStatus;
  groupName: string | null;
  /** When the status was set -- the withdrawal date, for a withdrawn candidate. */
  courseStatusSetAt: string | null;
}

// The card grid's own per-candidate status dots -- same three dimensions
// the readiness check above already computes per-issue, reshaped into the
// "3 status dots, green if met, amber if not" the spec's card layout wants.
export async function buildCandidateCards(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<CandidateCardData[]> {
  const { data: trainees } = await supabase
    .from("profiles")
    .select("id, full_name, course_status, course_status_set_at, selected_for_assessor_visit")
    .eq("course_id", courseId)
    .eq("role", "trainee")
    .order("full_name");

  const traineeIds = (trainees ?? []).map((t) => t.id);
  if (traineeIds.length === 0) return [];

  const cutoff = await assignmentCutoff(supabase, courseId);
  const [{ data: records }, { data: assignments }, , { data: planAssignments }, { data: subgroups }, { data: tpGroups }] = await Promise.all([
    supabase.from("celta5_records").select("*").eq("course_id", courseId),
    supabase.from("assignments").select("*").in("trainee_id", traineeIds),
    supabase.from("celta5_matrix").select("trainee_id, criteria_code, tutor_status_stage2").eq("course_id", courseId),
    supabase.from("plan_assignments").select("trainee_id, tp_point_id, taught_at").eq("course_id", courseId),
    supabase.from("course_subgroups").select("id, name, tp_group_id").eq("course_id", courseId),
    supabase.from("course_tp_groups").select("id, name").eq("course_id", courseId),
  ]);

  // The candidate's TP group, for the MCT wall's card subtitle. A subgroup
  // belongs to a TP group where one is set, and the TP group's name is what
  // the timetable and the roster both show, so that is the name used here.
  const { data: subgroupMembers } =
    (subgroups ?? []).length > 0
      ? await supabase
          .from("course_subgroup_members")
          .select("subgroup_id, trainee_id")
          .in("subgroup_id", (subgroups ?? []).map((g) => g.id))
      : { data: [] as { subgroup_id: string; trainee_id: string }[] };
  const tpGroupNameById = new Map((tpGroups ?? []).map((g) => [g.id, g.name]));
  const subgroupById = new Map((subgroups ?? []).map((g) => [g.id, g]));
  const groupNameByTrainee = new Map(
    (subgroupMembers ?? []).map((m) => {
      const sg = subgroupById.get(m.subgroup_id);
      return [m.trainee_id, sg ? (sg.tp_group_id ? (tpGroupNameById.get(sg.tp_group_id) ?? sg.name) : sg.name) : null];
    })
  );
  // Same unscoped-table-scan fix as computeAssessorReadiness above -- see the
  // note there. This is the second of the two copies the page paid for.
  const usedPointIds = [...new Set((planAssignments ?? []).map((p) => p.tp_point_id).filter((x): x is string => Boolean(x)))];
  const { data: tpPoints } = usedPointIds.length
    ? await supabase.from("tp_points").select("id, tp_coursebook_id").in("id", usedPointIds)
    : { data: [] };
  const tpPointCoursebookById = new Map((tpPoints ?? []).map((p) => [p.id, p.tp_coursebook_id]));
  const usedBookIds = [...new Set([...tpPointCoursebookById.values()].filter((x): x is string => Boolean(x)))];
  const { data: coursebooks } = usedBookIds.length ? await supabase.from("tp_coursebooks").select("id, level").in("id", usedBookIds) : { data: [] };
  const coursebookLevelById = new Map((coursebooks ?? []).map((c) => [c.id, c.level]));

  const recordByTrainee = new Map((records ?? []).map((r) => [r.trainee_id, r]));

  return (trainees ?? []).map((trainee) => {
    const record = recordByTrainee.get(trainee.id);
    const traineeAssignments = (assignments ?? []).filter((a) => a.trainee_id === trainee.id);
    const taughtAssignments = (planAssignments ?? []).filter((p) => p.trainee_id === trainee.id && p.taught_at);
    const assessedTp = computeAssessedTpStats({ taughtAssignments, tpPointCoursebookById, coursebookLevelById });

    const stage3Open = Boolean(record?.stage3_tutorial_required && !record.stage3_finalized_at);
    const celta5Complete = Boolean(record?.stage2_completed_at && record?.trainee_signoff_stage2_at) && !stage3Open;
    const celta5Detail = !record
      ? "No CELTA 5 record started yet"
      : !record.stage2_completed_at
        ? "Stage Two not completed by the tutor yet"
        : !record.trainee_signoff_stage2_at
          ? "Stage Two complete, waiting on the candidate's signature"
          : stage3Open
            ? "Stage Three record still open"
            : record.stage3_tutorial_required
              ? "Stages One, Two and Three complete and signed"
              : "Stages One and Two complete and signed";
    const tpsComplete = assessedTp.tpsTaught >= 8;
    const assignmentsComplete = traineeAssignments.every((a) => {
      if (!dueByCutoff(a, cutoff)) return true; // not yet due on the visit day (12.1.3)
      const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
      const status = isResubmissionRound ? a.resubmission_status : a.first_status;
      return status === "approved";
    });

    let flaggedIssue: string | null = null;
    if (stage3Open) flaggedIssue = "Stage Three record still open";
    else if (!assignmentsComplete) {
      const unresolved = traineeAssignments.find((a) => {
        if (!dueByCutoff(a, cutoff)) return false;
        const isResubmissionRound = a.first_status === "resubmission_required" || a.resubmission_status !== "not_submitted";
        const status = isResubmissionRound ? a.resubmission_status : a.first_status;
        return status !== "approved";
      });
      if (unresolved) {
        // Name the actual state, not "resubmission" for everything. A first
        // submission awaiting the tutor is not a resubmission, and telling an
        // assessor "Skills resubmission unresolved" when the candidate has
        // never resubmitted anything is simply wrong. A candidate on their
        // one resubmission is the only case that carries that word.
        const onResub = unresolved.first_status === "resubmission_required" || unresolved.resubmission_status !== "not_submitted";
        const round = onResub ? unresolved.resubmission_status : unresolved.first_status;
        const state = onResub
          ? round === "not_submitted"
            ? "resubmission outstanding"
            : "resubmission awaiting marking"
          : round === "not_submitted"
            ? "not yet submitted"
            : "awaiting marking";
        flaggedIssue = `${unresolved.assignment_type} ${state}`;
      }
    } else if (!celta5Complete) flaggedIssue = "Stage 2 record still open";

    return {
      traineeId: trainee.id,
      name: trainee.full_name,
      tpsTaught: assessedTp.tpsTaught,
      hoursAssessed: assessedTp.hoursAssessed,
      levels: assessedTp.levels,
      provisionalLabel: record?.provisional_grade
        ? record.provisional_grade_upper
          ? `${record.provisional_grade} / ${record.provisional_grade_upper}`
          : record.provisional_grade
        : null,
      celta5Complete,
      celta5Detail,
      tpsComplete,
      assignmentsComplete,
      flaggedIssue,
      selectedForAssessorVisit: trainee.selected_for_assessor_visit,
      courseStatus: trainee.course_status,
      groupName: groupNameByTrainee.get(trainee.id) ?? null,
      courseStatusSetAt: trainee.course_status_set_at,
    };
  });
}
