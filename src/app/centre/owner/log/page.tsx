import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { toLocalIso, zonedTimeToUtc, DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { formatDateTime } from "@/lib/format-date";
import { OwnerRegisterStyles } from "@/app/centre/owner/owner-register";

// The list behind "Owner actions logged -- 3 this month".
//
// That figure sat on the owner's screen counting rows nobody could read:
// the only rendering of this log was six lines at the foot of Centre
// Management's Roles page, a different room. Ramy, 1 Sep 2026, on what the
// owner can actually do from their own screen: "they just have, like, some
// numbers on top, and that's all. What am I missing?"
//
// This is his own rule applied to the owner: "wherever more than one person
// can act on a management area, log actor + before/after + when." The log
// was already being written that way (migration 0263 added course_id and
// the before/after pair); it just had nowhere to be read in full.

// The log's `action` column is written two ways: some callers store a
// sentence ("Transferred ownership to ..."), most store a slug. Six lines
// on the Roles page printed the slug raw, which nobody noticed while the
// log was six lines long. A full page of "permission_override.set" is a
// different matter.
//
// Unknown slugs fall back to the raw value rather than being hidden or
// guessed at: a log that quietly renames what it does not recognise is
// worse than one that shows you the slug.
const ACTION_LABELS: Record<string, string> = {
  "areas.assign": "Assigned an area",
  "branch_visibility.set": "Changed what a branch can see",
  "custom_capability.add": "Created a custom permission",
  "custom_role.add": "Created a custom role",
  "permission_override.set": "Changed what a role can do",
  "permission_override.reset": "Reset a role to its default",
  "roles.grant": "Gave someone a role",
  "roles.revoke": "Removed someone's role",
  "roles.invite": "Invited someone to a role",
  "roles.invite.revoke": "Withdrew an invitation",
  "tutor.role_changed": "Changed a tutor's role",
  "close_out.deletion_delayed": "Delayed a course close-out deletion",
  "ownership.transfer": "Transferred centre ownership",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export default async function OwnerActionLogPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const ctx = await getCentreRoleContext(profile);
  if (!ctx.roles.includes("centre_owner")) redirect("/centre");

  // Same scoping as the owner's landing page: the figure this list explains
  // follows the branch filter, so the list has to as well, or clicking a
  // number for one branch would open a log for another.
  const { branch } = await searchParams;
  const mine = ctx.availableCenterIds.filter(Boolean);
  const scope = branch && mine.includes(branch) ? [branch] : mine.length > 0 ? mine : [profile.center_id];
  const aggregated = scope.length > 1;

  const admin = createAdminClient();
  const [cachedCentre, { data: entries }, { data: centres }] = await Promise.all([
    getCachedCenter(scope[0]),
    admin
      .from("centre_owner_actions")
      .select("id, action, created_at, actor_profile_id, center_id, previous_value, new_value")
      .in("center_id", scope)
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("centers").select("id, name, time_zone").in("id", scope),
  ]);

  const actorIds = [...new Set((entries ?? []).map((e) => e.actor_profile_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  const branchOf = new Map((centres ?? []).map((c) => [c.id, c.name]));
  // Branch-scoped: each entry is dated where its own branch is.
  const zoneByCentre = new Map((centres ?? []).map((c) => [c.id, c.time_zone ?? DEFAULT_TIMEZONE]));

  const timeZone = cachedCentre?.time_zone ?? DEFAULT_TIMEZONE;
  const today = toLocalIso(new Date(), timeZone);
  // The same instant the owner's landing counts from -- that page links
  // here with its own figure, and a date-prefix string compare against a
  // timestamptz disagreed with it by up to a day at the boundary.
  const monthStart = zonedTimeToUtc(`${today.slice(0, 7)}-01`, "00:00", timeZone).toISOString();
  const thisMonth = (entries ?? []).filter((e) => e.created_at >= monthStart).length;

  return (
    <div className="owner-surface -m-6 flex flex-col">
      {/* Remainder pass A5: this page is the owner's, not Centre
          Management's. It used to render in the room idiom -- cream page,
          plain cards, a grey text link back -- so an owner clicked a figure
          on their own dark-band screen and landed somewhere else entirely. */}
      <div className="owner-header flex flex-wrap items-start justify-between gap-6 px-11 py-9">
        <div className="min-w-0">
          <p className="owner-eyebrow" style={{ color: "oklch(78% 0.03 75)" }}>
            Centre owner · Owner actions
          </p>
          <h1 className="owner-serif mt-2 text-[33px] font-semibold text-[oklch(98%_0.008_85)]">Owner actions</h1>
          <p className="mt-2 max-w-[560px] text-[13px] leading-relaxed text-[oklch(74%_0.025_75)]">
            Every intervention an owner makes is recorded — visible logging, not silent senior access.{" "}
            {thisMonth} {thisMonth === 1 ? "action" : "actions"} this month
            {aggregated ? " across all branches" : ""}.
          </p>
        </div>
        <Link
          href={`/centre/owner${branch ? `?branch=${branch}` : ""}`}
          className="owner-serif shrink-0 text-[15px] underline decoration-1 underline-offset-4"
          style={{ color: "oklch(84% 0.05 75)" }}
        >
          Back to centre owner
        </Link>
      </div>

      <div className="flex flex-col gap-[30px] px-11 py-9">
        {(entries ?? []).length === 0 ? (
          <div className="owner-card px-7 py-6 text-[13px]" style={{ color: "var(--owner-muted)" }}>
            Nothing logged yet.
          </div>
        ) : (
          <div className="owner-card flex flex-col">
            {(entries ?? []).map((e, i) => (
              <div
                key={e.id}
                className="wash flex items-start justify-between gap-4 px-7 py-3.5"
                style={i > 0 ? { borderTop: "1px solid var(--owner-line)" } : undefined}
              >
                <div className="flex flex-col gap-0.5">
                  <p className="text-[13px]">{actionLabel(e.action)}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--owner-muted)" }}>
                    {nameOf.get(e.actor_profile_id) ?? "Unknown"}
                    {aggregated && branchOf.get(e.center_id) ? ` · ${branchOf.get(e.center_id)}` : ""}
                    {/* Recorded since migration 0263. Only shown when it is
                        actually a change of value -- most entries are an act,
                        not an edit, and printing "— → —" against those would
                        be noise. */}
                    {e.previous_value !== null || e.new_value !== null
                      ? ` · ${e.previous_value ?? "not set"} → ${e.new_value ?? "not set"}`
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 text-[11.5px] tabular-nums" style={{ color: "var(--owner-muted)" }}>
                  {formatDateTime(e.created_at, zoneByCentre.get(e.center_id) ?? DEFAULT_TIMEZONE)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <OwnerRegisterStyles />
    </div>
  );
}
