import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { can } from "@/lib/auth/centre-permissions";
import { resolveBranchScope } from "@/lib/branch-scope";
import { CentreConcernReplyForm } from "@/app/centre/concerns/reply-form";

// The far end of the internal complaints route.
//
// Administration Handbook 16.1 requires the centre's procedure to offer
// "recourse to someone other than the tutors on the course", and the
// candidate's own form names it: "The centre manager -- independent of the
// teaching team. For anything you would rather the tutors did not see first."
// Until 6 Sep 2026 that promise had nowhere to land -- migration 0140 let
// every trainer on the course read those concerns, and no centre screen
// listed them at all. Migration 0280 closed the leak; this is the door that
// makes the route mean something.
//
// 16.4 is why it matters beyond politeness: Cambridge "is not able to
// investigate ... incidents that took place during the course for which there
// is no record". A concern answered here is that record.
export default async function CentreConcernsPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const { branch } = await searchParams;
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const ctx = await getCentreRoleContext(session.profile);
  if (!can(ctx.roles, "concerns.manage", ctx.overrides)) redirect("/centre");

  const supabase = await createClient();
  const admin = createAdminClient();

  // Centre Management is branch-aware: a person holding more than one branch
  // sees all of them unless they have filtered to one, so the complaints route
  // must not go quiet on a branch just because it is not the active centre.
  const { scope } = await resolveBranchScope(session.profile, branch);
  const { data: courses } = await admin.from("courses").select("id, name").in("center_id", scope);
  const courseNameById = new Map((courses ?? []).map((c) => [c.id, c.name]));

  // RLS's admin policy is what permits this; the route filter is what makes
  // the page about one thing. Tutor- and MCT-routed concerns stay in the
  // tutors' own inbox, where the people answering them can see the course.
  const { data: concerns } = await supabase
    .from("concerns")
    .select("*")
    .eq("route", "manager")
    .in("course_id", (courses ?? []).map((c) => c.id))
    .order("created_at", { ascending: false });

  // Anonymity is application-level by design (migration 0140): the name is
  // never fetched for an anonymous concern, so it cannot leak through a
  // serialised prop either.
  const namedIds = [...new Set((concerns ?? []).filter((c) => !c.anonymous).map((c) => c.trainee_id))];
  const { data: people } = namedIds.length > 0 ? await admin.from("profiles").select("id, full_name").in("id", namedIds) : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const open = (concerns ?? []).filter((c) => !c.response);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Centre management &middot; Concerns</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">Sent past the tutors</h1>
        <p className="max-w-[68ch] text-sm text-muted">
          Concerns a candidate chose to raise with the centre rather than with their tutors. No tutor on the course can
          read these, reply to them, or tell that one exists &mdash; Administration Handbook &sect;16.1 asks for recourse
          beyond the teaching team, and this is it. {open.length > 0 ? `${open.length} waiting for a reply.` : "All answered."}
        </p>
      </div>

      {(concerns ?? []).length === 0 ? (
        <p className="rounded-[14px] border border-border bg-card px-[22px] py-5 text-sm text-muted">
          Nobody has taken this route. That is the ordinary state &mdash; the tutors&apos; own inbox is where most concerns
          land.
        </p>
      ) : (
        (concerns ?? []).map((c) => (
          <section key={c.id} className="flex flex-col gap-3 rounded-[14px] border border-border bg-card px-[22px] py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-ink">
                {c.anonymous ? "Anonymous" : (nameById.get(c.trainee_id) ?? "Candidate")}
                <span className="font-normal text-muted"> &middot; {courseNameById.get(c.course_id) ?? "Course"}</span>
              </span>
              <span className="text-[11.5px] text-muted">
                {new Date(c.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>
            <p className="text-sm leading-[1.6] whitespace-pre-wrap text-ink">{c.body}</p>
            {c.response ? (
              <div className="rounded-[10px] bg-card-inset px-4 py-3">
                <p className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">The centre replied</p>
                <p className="mt-1 text-sm leading-[1.55] whitespace-pre-wrap text-ink">{c.response}</p>
              </div>
            ) : (
              <CentreConcernReplyForm concernId={c.id} />
            )}
          </section>
        ))
      )}
    </div>
  );
}
