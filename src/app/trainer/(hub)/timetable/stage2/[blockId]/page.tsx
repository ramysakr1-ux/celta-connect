import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ordinal } from "@/lib/stage2-tutorials";
import { updateStage2Duration } from "@/app/trainer/(hub)/timetable/stage2-actions";

export default async function Stage2BlockPage({ params }: { params: Promise<{ blockId: string }> }) {
  const trainer = await requireRole(["trainer", "admin"]);
  const { blockId } = await params;
  const supabase = await createClient();

  const { data: block } = await supabase.from("stage2_tutorial_blocks").select("*").eq("id", blockId).maybeSingle();
  if (!block || block.course_id !== trainer.course_id) notFound();

  const [{ data: event }, { data: slots }] = await Promise.all([
    supabase.from("course_timetable_events").select("*").eq("id", block.timetable_event_id).maybeSingle(),
    supabase.from("stage2_tutorial_slots").select("id, position, trainee_id").eq("block_id", blockId).order("position"),
  ]);

  const traineeIds = (slots ?? []).map((s) => s.trainee_id).filter((id): id is string => !!id);
  const { data: trainees } = traineeIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", traineeIds) : { data: [] };
  const nameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));

  const currentDuration = (slots ?? []).length * 15;

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet">
        <p className="text-xs text-muted">Stage 2 tutorials</p>
        <h1 className="font-serif text-xl text-ink">
          {event?.event_date} {event?.event_time?.slice(0, 5)}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Around 15–20 min each, starting from {event?.event_time?.slice(0, 5)}. Running a few minutes over is
          normal -- check with your group before you assume you&apos;re late.
        </p>
      </div>

      <div className="sheet">
        <h2 className="font-serif text-lg text-ink">Positions</h2>
        <div className="mt-3 flex flex-col">
          {(slots ?? []).map((s, i) => (
            <div key={s.id} className={`flex items-center justify-between py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
              <span className="text-sm text-ink">{ordinal(s.position)}</span>
              <span className="text-sm text-muted">{s.trainee_id ? nameById.get(s.trainee_id) ?? "Unknown" : "Open"}</span>
            </div>
          ))}
          {(slots ?? []).length === 0 ? <p className="py-2 text-sm text-muted">No positions yet.</p> : null}
        </div>
      </div>

      <div className="sheet">
        <h2 className="font-serif text-lg text-ink">Adjust length</h2>
        <p className="mt-1 text-sm text-muted">
          Too short? Lengthen it -- unbooked positions regenerate, anyone already booked keeps their position.
        </p>
        <form action={updateStage2Duration} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="block_id" value={blockId} />
          <input
            name="duration_minutes"
            type="number"
            min={15}
            step={15}
            defaultValue={currentDuration}
            className="h-10 w-32 rounded-[6px] border border-border bg-card px-3 text-sm text-ink outline-none focus:border-primary"
          />
          <button type="submit" className="rounded-[6px] border border-border px-3 py-2 text-sm text-ink hover:border-primary">
            Update
          </button>
        </form>
      </div>
    </div>
  );
}
