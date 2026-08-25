import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PulseStripStats {
  centresLive: number;
  centresRunningNow: number;
  activeTraineesAccessible: number;
  coursesRunningNow: number;
  courseRunningLabel: string;
  openSupportThreads: number;
}

// Shown at the top of every Command Center section (command-center-full-
// spec.md's "all sections, top of main") -- computed once per request here
// rather than duplicated per page, though each section route still calls
// this itself (Next layouts and pages don't share a data fetch directly).
export async function getPulseStripStats(profileId: string): Promise<PulseStripStats> {
  const admin = createAdminClient();

  const [{ data: centers }, { data: ownerRoles }, { data: invites }, { data: courses }, { data: supportMessages }] = await Promise.all([
    admin.from("centers").select("id"),
    admin.from("centre_roles").select("center_id").eq("profile_id", profileId).eq("role", "centre_owner").is("revoked_at", null),
    admin.from("platform_owner_invites").select("center_id").is("revoked_at", null),
    admin.from("courses").select("id, center_id, name, start_date, end_date"),
    admin.from("support_messages").select("id, read_at"),
  ]);

  const ownedCenterIds = new Set((ownerRoles ?? []).map((r) => r.center_id));
  const invitedCenterIds = new Set((invites ?? []).map((i) => i.center_id));
  const accessibleCenterIds = new Set([...ownedCenterIds, ...invitedCenterIds]);

  const today = new Date().toISOString().slice(0, 10);
  const coursesList = courses ?? [];
  const runningCourses = coursesList.filter((c) => c.start_date <= today && c.end_date >= today);
  const centresRunningNow = new Set(runningCourses.map((c) => c.center_id)).size;

  const { data: trainees } =
    accessibleCenterIds.size > 0
      ? await admin.from("profiles").select("center_id").eq("role", "trainee").in("center_id", [...accessibleCenterIds])
      : { data: [] };

  return {
    centresLive: (centers ?? []).length,
    centresRunningNow,
    activeTraineesAccessible: (trainees ?? []).length,
    coursesRunningNow: runningCourses.length,
    courseRunningLabel: runningCourses[0]?.name ?? "",
    openSupportThreads: (supportMessages ?? []).filter((m) => !m.read_at).length,
  };
}
