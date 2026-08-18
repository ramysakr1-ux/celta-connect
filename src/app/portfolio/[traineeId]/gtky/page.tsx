import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { GTKY_BANK } from "@/lib/gtky-activities";
import { GtkyPickForm } from "@/app/portfolio/[traineeId]/gtky/pick-form";

// design_handoff_open_items_batch, GTKY Activity Bank.dc.html §1c -- the
// candidate's own handout, one page, three options. Access is
// RLS-enforced ("gtky_assignments: trainee reads their own"), same
// pattern as the Stage 1/3 individual tutorial page.
export default async function GtkyChoicePage({ params }: { params: Promise<{ traineeId: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId } = await params;
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("gtky_assignments")
    .select("offered_slugs, chosen_slug")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (!assignment) notFound();

  const bySlug = new Map(GTKY_BANK.map((a) => [a.slug, a]));
  const activities = assignment.offered_slugs.map((s) => bySlug.get(s)).filter((a): a is NonNullable<typeof a> => !!a);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">
          Your day-one activity · unassessed · nobody is watching
        </p>
        <h1 className="mt-1 font-serif text-2xl text-ink">Getting to know your class</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Twenty minutes, unassessed, and the tutor is not in the room. Three options below, matched to the level
          you will teach -- choose whichever appeals, and tell your tutor on the first morning.
        </p>
      </div>

      <GtkyPickForm activities={activities} chosenSlug={assignment.chosen_slug} />
    </div>
  );
}
