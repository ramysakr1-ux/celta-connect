import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { GTKY_BANK } from "@/lib/gtky-activities";
import { GtkyPickForm } from "@/app/portfolio/[traineeId]/gtky/pick-form";
import { SessionMaterialsSection } from "@/components/session-materials-section";

// design_handoff_open_items_batch, GTKY Activity Bank.dc.html §1c -- the
// candidate's own handout, one page, three options. Access is
// RLS-enforced ("gtky_assignments: trainee reads their own"), same
// pattern as the Stage 1/3 individual tutorial page.
export default async function GtkyChoicePage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  const session = await getCurrentProfile();
  // for-claude-code-course-emails.md / review-notes.md: the welcome email's
  // activities link must still work for a candidate who hasn't set up their
  // account yet -- send them to sign up/in first, then land back here,
  // instead of dropping them on the generic post-login /dashboard.
  if (!session?.profile) redirect(`/login?next=${encodeURIComponent(`/portfolio/${traineeId}/gtky`)}`);
  const supabase = await createClient();

  const { data: assignment } = await supabase
    .from("gtky_assignments")
    .select("course_id, offered_slugs, chosen_slug")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (!assignment) notFound();

  const bySlug = new Map(GTKY_BANK.map((a) => [a.slug, a]));
  const activities = assignment.offered_slugs.map((s) => bySlug.get(s)).filter((a): a is NonNullable<typeof a> => !!a);

  // Ramy, 25 Aug 2026: "it's gonna read whatever is on the timetable" --
  // materials share against the real calendar event a trainer already
  // created for this (same "Milestone" event type/title a trainer can add
  // via the ordinary timetable editor), matched by title since GTKY has no
  // formal link to the calendar today. Best-effort: no matching event yet
  // just means nothing to share against, not an error.
  const { data: gtkyEvent } = await supabase
    .from("course_timetable_events")
    .select("id, title")
    .eq("course_id", assignment.course_id)
    .neq("type", "tp")
    .ilike("title", "%getting to know%")
    .order("event_date")
    .limit(1)
    .maybeSingle();

  const { data: materials } = gtkyEvent
    ? await supabase.from("session_materials").select("id, file_name, file_type, storage_path, slides_url, uploaded_by").eq("timetable_event_id", gtkyEvent.id).order("created_at")
    : { data: [] };

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

      <div className="card rounded-[9px] border-t-[var(--trainee-plum)] p-6">
        <h2 className="font-serif text-lg text-ink">Materials</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Anything you&apos;d like the volunteer students to see beforehand -- a handout, a slide, whatever you&apos;re using.
        </p>
        {gtkyEvent ? (
          <SessionMaterialsSection
            timetableEventId={gtkyEvent.id}
            courseId={assignment.course_id}
            viewerId={traineeId}
            materials={materials ?? []}
            revalidatePath={`/portfolio/${traineeId}/gtky`}
          />
        ) : (
          <p className="text-sm text-muted">
            Ask your tutor to add &quot;Getting to know you&quot; to the course timetable first -- materials share against that.
          </p>
        )}
      </div>
    </div>
  );
}
