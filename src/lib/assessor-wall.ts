import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CandidateCardData } from "@/lib/assessor-pack";
import { halfOwningDate, halfTpDates, rotationPosition } from "@/lib/rotation";

// design_handoff_assessor_landing_v2's grouping rules, for the MCT's Assessor
// tab only. Ramy, 6 Sep 2026: "the assessor landing page is not changing,
// don't touch that" -- so nothing here is imported by /assessor, and that
// page keeps the layout it has always had.
//
// The difference is voice, and it matters. On the assessor's page "you" is
// the assessor; on this one "you" is the MCT, who is not going to be reading
// anybody's portfolio. Same grouping, same order, sentences rewritten so the
// wall reads as "here is what your assessor is about to do."
//
// Nothing here queries per candidate: the wall is built from the cards
// buildCandidateCards already returns, plus one rotation derivation for the
// visit day.

export type WallSectionId = "observe" | "fail" | "passA" | "centre" | "withdrawn";

export interface WallCandidate extends CandidateCardData {
  section: WallSectionId;
  /** One sentence on why this portfolio is on the assessor's list. */
  why: string;
}

export interface TeachingSlot {
  traineeId: string;
  name: string;
  groupName: string | null;
}

const WHY: Record<WallSectionId, string> = {
  // Deliberately says nothing about reading: the recommendation panel above
  // decides which portfolios are read, and only two of the day's teachers
  // usually are. This line used to promise a full read for all of them.
  observe: "Teaching on the visit day, so their lesson plan is in the pack.",
  fail: "Potential Fail. The Handbook puts the borderline cases first.",
  passA: "Tutors expect Pass A. Worth reading to confirm the standard.",
  centre: "Put forward by the centre.",
  withdrawn: "The assessor checks the withdrawal letter and the application.",
};

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace("Sept", "Sep");
}

/**
 * Who teaches on the visit day, in teaching order.
 *
 * No table stores a date against a plan, so this is the same rotation
 * derivation the assessor's lesson-plans page uses: the visit date belongs to
 * one half, that half's position in its own list of TP dates gives the TP
 * number, and each member's rotation position for that number gives their
 * place among the day's TP slots, which are already ordered by time.
 */
export async function visitTeachingOrder(
  supabase: SupabaseClient<Database>,
  courseId: string,
  visitDate: string | null,
  candidates: CandidateCardData[]
): Promise<{ slots: TeachingSlot[]; tpNumber: number }> {
  if (!visitDate) return { slots: [], tpNumber: 0 };

  const [{ data: tpEvents }, { data: subgroups }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date").eq("course_id", courseId).eq("type", "tp"),
    supabase.from("course_subgroups").select("id, half_order").eq("course_id", courseId),
  ]);

  const half = halfOwningDate(tpEvents ?? [], visitDate);
  const tpNumber = half ? halfTpDates(tpEvents ?? [], half).indexOf(visitDate) + 1 : 0;
  if (!half || tpNumber <= 0) return { slots: [], tpNumber: 0 };

  const halfSubgroupIds = (subgroups ?? []).filter((sg) => sg.half_order === half).map((sg) => sg.id);
  if (halfSubgroupIds.length === 0) return { slots: [], tpNumber };

  const { data: members } = await supabase
    .from("course_subgroup_members")
    .select("subgroup_id, trainee_id, base_slot")
    .in("subgroup_id", halfSubgroupIds);

  const sizeBySubgroup = new Map(halfSubgroupIds.map((id) => [id, (members ?? []).filter((m) => m.subgroup_id === id).length]));
  const slots = (members ?? [])
    .map((m) => {
      const candidate = candidates.find((c) => c.traineeId === m.trainee_id);
      return {
        traineeId: m.trainee_id,
        name: candidate?.name ?? null,
        groupName: candidate?.groupName ?? null,
        order: rotationPosition(m.base_slot, sizeBySubgroup.get(m.subgroup_id) ?? 1, tpNumber) + 1,
      };
    })
    .filter((x): x is TeachingSlot & { order: number } => Boolean(x.name))
    .sort((a, b) => a.order - b.order)
    .map(({ traineeId, name, groupName }) => ({ traineeId, name, groupName }));

  return { slots, tpNumber };
}

/**
 * Which section a candidate belongs to.
 *
 * Withdrawn is tested first: a withdrawn candidate has no business appearing
 * under "will watch these teach" even where the rotation still names them for
 * that day. After that the Handbook's own order applies -- its trigger is
 * "Fail or potential Fail", and the only provisional slots carrying Fail at
 * all are Fail and Fail/Pass, so a substring test is the whole rule rather
 * than an approximation of one.
 */
export function sectionFor(c: CandidateCardData, observeIds: Set<string>): WallSectionId {
  if (c.courseStatus === "withdrawn") return "withdrawn";
  if (observeIds.has(c.traineeId)) return "observe";
  if (c.provisionalLabel?.includes("Fail")) return "fail";
  if (c.provisionalLabel === "Pass A") return "passA";
  return "centre";
}

/**
 * The wall itself.
 *
 * for-claude-code-assessor-pack-decisions.md §1: the centre's selection is the
 * default view, never a restriction. Everyone the Handbook names -- the ones
 * teaching that day, the Fail cases, the withdrawn -- stays on the list
 * whether the centre put them forward or not.
 */
export function buildWall(candidates: CandidateCardData[], observeIds: Set<string>, wantsFullCohort: boolean): WallCandidate[] {
  return candidates
    .map((c) => {
      const section = sectionFor(c, observeIds);
      const why =
        section === "withdrawn"
          ? c.courseStatusSetAt
            ? `Withdrew ${shortDate(c.courseStatusSetAt.slice(0, 10))}. ${WHY.withdrawn}`
            : `Withdrew from the course. ${WHY.withdrawn}`
          : section === "centre" && !c.selectedForAssessorVisit
            ? "Not put forward by the centre. The assessor can still open it."
            : WHY[section];
      return { ...c, section, why };
    })
    .filter(
      (c) =>
        wantsFullCohort ||
        c.selectedForAssessorVisit ||
        c.section === "observe" ||
        c.section === "fail" ||
        c.section === "withdrawn"
    );
}

/**
 * Counts honestly. Ramy, 30 Aug 2026: every slot on the day is named, and
 * which two get observed is agreed on the day -- so a course with three
 * teaching that day must not read as three observations.
 */
export function observeHeading(slotCount: number): string {
  if (slotCount === 1) return "The assessor watches this candidate teach";
  if (slotCount === 2) return "The assessor watches these two teach";
  return "The assessor watches two of these teach";
}

export function observeNote(tpNumber: number, slots: TeachingSlot[]): string {
  const groups = [...new Set(slots.map((s) => s.groupName).filter((g): g is string => Boolean(g)))];
  return [
    tpNumber > 0 ? `TP${tpNumber}` : null,
    groups.length > 0 ? groups.join(" and ") : null,
    "at least one of these portfolios is read in full",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function wallFootLine(totalCount: number, selectedCount: number, wantsFullCohort: boolean): string {
  return wantsFullCohort
    ? `All ${totalCount} candidates. You put ${selectedCount} forward; the final choice is the assessor's, in consultation with you (§15.1).`
    : `${selectedCount} of ${totalCount} put forward. The final choice is the assessor's, in consultation with you (§15.1).`;
}
