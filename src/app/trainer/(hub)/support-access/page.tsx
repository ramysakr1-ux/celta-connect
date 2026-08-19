import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCourseMct, computeGrantStatus } from "@/lib/platform-support";
import { CourseSupportAccessForm } from "@/app/trainer/(hub)/support-access/course-support-access-form";
import type { SupportGrantRow } from "@/app/centre/settings/support-access-tab";

// specs/for-claude-code-platform-support-access.md: "Course scope...
// granted by that course's main tutor." Not a nav tab -- reached from
// wherever the MCT is told support needs a look, same non-tab pattern as
// Announcements. The billing-scope counterpart lives in Centre Settings,
// gated to centre_administrator/centre_owner instead -- two different
// granters for two different scopes, per the spec.
export default async function TrainerSupportAccessPage() {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile || !profile.course_id) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const admin = createAdminClient();
  const isMct = await isCourseMct(admin, profile.id, profile.course_id);
  if (!isMct) {
    return (
      <div className="sheet p-6 text-sm text-muted">
        Only this course&apos;s main tutor can grant platform support access to it.
      </div>
    );
  }

  const { data: grants } = await admin
    .from("platform_support_grants")
    .select("*")
    .eq("course_id", profile.course_id)
    .order("granted_at", { ascending: false });

  const granterIds = [...new Set((grants ?? []).map((g) => g.granted_by))];
  const { data: granters } = granterIds.length ? await admin.from("profiles").select("id, full_name").in("id", granterIds) : { data: [] };
  const granterNameById = new Map((granters ?? []).map((p) => [p.id, p.full_name]));

  const { data: course } = await admin.from("courses").select("name").eq("id", profile.course_id).maybeSingle();

  const rows: SupportGrantRow[] = (grants ?? []).map((g) => ({
    id: g.id,
    scope: g.scope,
    courseName: course?.name ?? null,
    reason: g.reason,
    grantedByName: granterNameById.get(g.granted_by) ?? "Unknown",
    grantedAt: g.granted_at,
    durationHours: g.duration_hours,
    status: computeGrantStatus(g),
    chatIncluded: g.chat_included,
  }));

  return <CourseSupportAccessForm courseName={course?.name ?? "your course"} grants={rows} />;
}
