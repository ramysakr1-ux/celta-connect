import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { ordinal } from "@/lib/stage2-tutorials";
import { BookSlotButton } from "@/app/portfolio/[traineeId]/stage2-tutorial/[blockId]/book-slot-button";
import { releaseStage2Slot } from "@/app/trainer/(hub)/timetable/stage2-actions";

// Trainee-facing side of the Stage 2 tutorial booking sheet (§3a). Access
// is enforced by RLS, not by traineeId in the URL -- a candidate only ever
// sees blocks belonging to a TP group they're actually a member of
// (migration 0094's "trainee reads their own group's blocks" policy), so
// this page just renders whatever the RLS-scoped client returns rather
// than re-deriving group membership itself.
export default async function TraineeStage2TutorialPage({
  params,
}: {
  params: Promise<{ traineeId: string; blockId: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId, blockId } = await params;
  const supabase = await createClient();

  const { data: block } = await supabase.from("stage2_tutorial_blocks").select("*").eq("id", blockId).maybeSingle();
  if (!block) notFound();

  const [{ data: event }, { data: slots }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date, event_time").eq("id", block.timetable_event_id).maybeSingle(),
    supabase.from("stage2_tutorial_slots").select("id, position, trainee_id").eq("block_id", blockId).order("position"),
  ]);
  const traineeIds = (slots ?? []).map((s) => s.trainee_id).filter((id): id is string => !!id);
  const { data: trainees } = traineeIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", traineeIds) : { data: [] };
  const nameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));

  const myProfileId = session.profile.id;
  const mySlot = (slots ?? []).find((s) => s.trainee_id === myProfileId);
  const hasOpenSlot = (slots ?? []).some((s) => !s.trainee_id);

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/portfolio/${traineeId}`} className="text-xs text-muted hover:text-primary">
        ← Course stream
      </Link>

      <div className="sheet">
        <p className="text-xs text-muted">Stage 2 tutorials</p>
        <h1 className="font-serif text-xl text-ink">
          {event?.event_date} {event?.event_time?.slice(0, 5)}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Around 15–20 min each, starting from {event?.event_time?.slice(0, 5)}. Running a few minutes over is
          normal -- check with your group before you assume you&apos;re late. One booking each -- pick a position
          below, or release it if your plans change.
        </p>
      </div>

      {/* Decorative teal/garnet alternation against the header sheet above --
          no status meaning of its own, same rule as everywhere else. */}
      <div className="sheet sheet-garnet">
        <div className="flex flex-col">
          {(slots ?? []).map((s, i) => {
            const isMine = s.trainee_id === myProfileId;
            return (
              <div key={s.id} className={`flex items-center justify-between py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <span className="text-sm text-ink">{ordinal(s.position)}</span>
                {s.trainee_id ? (
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${isMine ? "font-semibold text-primary" : "text-muted"}`}>
                      {isMine ? "You" : (nameById.get(s.trainee_id) ?? "Unknown")}
                    </span>
                    {isMine ? (
                      <form action={releaseStage2Slot}>
                        <input type="hidden" name="slot_id" value={s.id} />
                        <input type="hidden" name="block_id" value={blockId} />
                        <button type="submit" className="text-xs text-destructive hover:underline">
                          Release
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-sm text-muted">Open</span>
                )}
              </div>
            );
          })}
          {(slots ?? []).length === 0 ? <p className="py-2 text-sm text-muted">No positions yet.</p> : null}
        </div>
      </div>

      {!mySlot && hasOpenSlot ? <BookSlotButton blockId={blockId} /> : null}
    </div>
  );
}
