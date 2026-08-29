import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { ConfirmButton } from "@/app/portfolio/[traineeId]/individual-tutorial/[inviteId]/confirm-button";

const STAGE_LABEL: Record<string, string> = { stage1: "Stage 1", stage3: "Stage 3" };

// Trainee-facing side of an individualized Stage 1/3 invite. Access is
// RLS-enforced (migration 0129's "trainee reads their own invite" policy),
// same "just render what the scoped client returns" pattern as the Stage 2
// trainee page -- there is no self-service claim step here, only a
// confirm, since the time was set by the trainer, not chosen from a pool.
export default async function TraineeIndividualTutorialPage({
  params,
}: {
  params: Promise<{ traineeId: string; inviteId: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId, inviteId } = await params;
  const supabase = await createClient();

  const { data: invite } = await supabase
    .from("individual_tutorial_invites")
    .select("id, stage, timetable_event_id, confirmed_at")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite) notFound();

  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("event_date, event_time")
    .eq("id", invite.timetable_event_id)
    .maybeSingle();

  const label = STAGE_LABEL[invite.stage] ?? invite.stage;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/portfolio/${traineeId}`} label={"Course stream"} />

      <div className="sheet flex flex-col gap-3">
        <p className="text-xs text-muted">{label} tutorial</p>
        <h1 className="font-serif text-xl text-ink">
          {event?.event_date}
          {event?.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}
        </h1>
        <p className="text-sm text-muted">Your tutor has set this time individually for you. Confirm below.</p>

        {invite.confirmed_at ? (
          <p className="text-sm font-semibold text-primary">Confirmed</p>
        ) : (
          <ConfirmButton inviteId={invite.id} />
        )}
      </div>
    </div>
  );
}
