import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { GTKY_BANK, gtkyLevelsAreNear, gtkyActivityEligibleForMode, gtkyLevelBandFromCourseLevel } from "@/lib/gtky-activities";

// for-claude-code-gtky-assignment-logic.md: "assigned before the course
// starts, once a candidate's level... and the course's mode... are both
// known -- typically once TP groups/levels are set." Nothing in the
// schema marks that moment automatically (a subgroup pairing and a TP1
// coursebook assignment are two separate trainer actions, sometimes far
// apart), so this is explicitly trainer-triggered rather than guessing a
// hook point -- same pattern as "Generate timetable skeleton."
// Idempotent per trainee (unique constraint on trainee_id): only assigns
// candidates who don't already have a row, and only once their TP1 level
// is actually resolvable.
export async function resolveGtkyAssignments(
  supabase: SupabaseClient<Database>,
  courseId: string
): Promise<{ assigned: number; skipped: number }> {
  const { data: course } = await supabase
    .from("courses")
    .select("center_id, delivery_mode")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) return { assigned: 0, skipped: 0 };

  // Mixed-mode candidates do all face-to-face TP first (for-claude-code-
  // mixed-mode-course.md), so TP1 -- and therefore their GTKY mode -- is
  // always face-to-face, never a per-course toggle.
  const courseMode: "f2f" | "online" = course.delivery_mode === "online" ? "online" : "f2f";

  const [{ data: trainees }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("id").eq("course_id", courseId).eq("role", "trainee").eq("course_status", "active"),
    supabase.from("gtky_assignments").select("trainee_id"),
  ]);
  const alreadyAssigned = new Set((existing ?? []).map((r) => r.trainee_id));
  const pendingTrainees = (trainees ?? []).filter((t) => !alreadyAssigned.has(t.id));
  if (pendingTrainees.length === 0) return { assigned: 0, skipped: 0 };

  const traineeIds = pendingTrainees.map((t) => t.id);
  const [{ data: subgroupMembers }, { data: tp1Plans }] = await Promise.all([
    supabase.from("course_subgroup_members").select("trainee_id, subgroup_id").in("trainee_id", traineeIds),
    supabase.from("plan_assignments").select("trainee_id, tp_point_id").eq("tp_number", 1).in("trainee_id", traineeIds),
  ]);

  const subgroupIds = [...new Set((subgroupMembers ?? []).map((m) => m.subgroup_id))];
  const { data: subgroups } =
    subgroupIds.length > 0 ? await supabase.from("course_subgroups").select("id, tp_group_id").in("id", subgroupIds) : { data: [] };
  const tpGroupIdBySubgroup = new Map((subgroups ?? []).map((s) => [s.id, s.tp_group_id]));
  const tpGroupIdByTrainee = new Map(
    (subgroupMembers ?? []).map((m) => [m.trainee_id, tpGroupIdBySubgroup.get(m.subgroup_id) ?? m.subgroup_id])
  );

  const tpPointIds = [...new Set((tp1Plans ?? []).map((p) => p.tp_point_id).filter((id): id is string => !!id))];
  const { data: tpPoints } =
    tpPointIds.length > 0 ? await supabase.from("tp_points").select("id, tp_coursebook_id").in("id", tpPointIds) : { data: [] };
  const coursebookIdByTpPoint = new Map((tpPoints ?? []).map((p) => [p.id, p.tp_coursebook_id]));
  const coursebookIds = [...new Set((tpPoints ?? []).map((p) => p.tp_coursebook_id))];
  const { data: coursebooks } =
    coursebookIds.length > 0 ? await supabase.from("tp_coursebooks").select("id, level").in("id", coursebookIds) : { data: [] };
  const levelByCoursebook = new Map((coursebooks ?? []).map((c) => [c.id, c.level]));
  const levelByTrainee = new Map(
    (tp1Plans ?? []).map((p) => {
      const coursebookId = p.tp_point_id ? coursebookIdByTpPoint.get(p.tp_point_id) : null;
      const level = coursebookId ? levelByCoursebook.get(coursebookId) : null;
      return [p.trainee_id, level ? gtkyLevelBandFromCourseLevel(level) : null] as const;
    })
  );

  // Fixed pool per (level band, mode) -- filtered once, not per trainee.
  const poolCache = new Map<string, typeof GTKY_BANK>();
  function poolFor(band: string) {
    const key = band;
    if (!poolCache.has(key)) {
      poolCache.set(
        key,
        GTKY_BANK.filter(
          (a) => gtkyLevelsAreNear(a.level, band as Parameters<typeof gtkyLevelsAreNear>[1]) && gtkyActivityEligibleForMode(a, courseMode)
        )
      );
    }
    return poolCache.get(key)!;
  }

  // "Exclude an activity already assigned to another candidate in the same
  // TP group before doing the next candidate's random pick." Cross-group
  // repeats are fine, so this only tracks per-tp_group_id.
  const offeredByTpGroup = new Map<string, Set<string>>();
  const { data: sameCourseAssignments } = await supabase
    .from("gtky_assignments")
    .select("trainee_id, offered_slugs")
    .eq("course_id", courseId);
  for (const row of sameCourseAssignments ?? []) {
    const tpGroupId = tpGroupIdByTrainee.get(row.trainee_id);
    if (!tpGroupId) continue;
    const set = offeredByTpGroup.get(tpGroupId) ?? new Set<string>();
    for (const slug of row.offered_slugs) set.add(slug);
    offeredByTpGroup.set(tpGroupId, set);
  }

  const rows: Database["public"]["Tables"]["gtky_assignments"]["Insert"][] = [];
  let skipped = 0;

  for (const trainee of pendingTrainees) {
    const band = levelByTrainee.get(trainee.id);
    if (!band) {
      skipped += 1; // TP1's level isn't resolvable yet -- nothing to offer.
      continue;
    }
    const tpGroupId = tpGroupIdByTrainee.get(trainee.id) ?? null;
    const alreadyOffered = tpGroupId ? offeredByTpGroup.get(tpGroupId) ?? new Set<string>() : new Set<string>();

    const pool = poolFor(band).filter((a) => !alreadyOffered.has(a.slug));
    const candidates = pool.length >= 3 ? pool : poolFor(band); // fall back if a group has run the pool dry
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 3);

    if (tpGroupId) {
      const set = offeredByTpGroup.get(tpGroupId) ?? new Set<string>();
      for (const a of picked) set.add(a.slug);
      offeredByTpGroup.set(tpGroupId, set);
    }

    rows.push({
      center_id: course.center_id,
      course_id: courseId,
      trainee_id: trainee.id,
      level_band: band,
      offered_slugs: picked.map((a) => a.slug),
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("gtky_assignments").insert(rows);
    if (error) return { assigned: 0, skipped: pendingTrainees.length };
  }

  return { assigned: rows.length, skipped };
}
