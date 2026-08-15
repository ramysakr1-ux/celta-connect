import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CaptureForm } from "@/app/trainer/(hub)/capture/capture-form";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

// specs/build-spec.md §7: "Trainer -- capture, not marking. Points typed or
// dictated during a TP, tagged and timestamped against the right
// candidate, appearing in the feedback form on the laptop." No "TP live
// right now" state exists anywhere in the schema (see migration 0099's own
// comment) -- the trainer picks candidate + TP number themselves, same as
// every other trainer-side form already does. Deliberately NOT
// laptop-gated -- this is the one trainer surface the mobile spec explicitly
// wants usable on a phone, mid-lesson.
export default async function CapturePage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();

  const { data: roster } = trainer.course_id
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("course_id", trainer.course_id)
        .eq("role", "trainee")
        .order("full_name")
    : { data: [] };

  const { data: recentNotes } = trainer.course_id
    ? await supabase
        .from("tp_capture_notes")
        .select("id, trainee_id, tp_number, text, captured_at")
        .eq("trainer_id", trainer.id)
        .order("captured_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const nameByTraineeId = new Map((roster ?? []).map((r) => [r.id, r.full_name]));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="sheet">
        <h1 className="font-serif text-xl text-ink">Capture a point</h1>
        <p className="mt-2 text-sm text-muted">
          Quick, typed or dictated, tagged and timestamped -- pull it into the real feedback form later, on your
          laptop.
        </p>
      </div>

      <CaptureForm roster={roster ?? []} tpNumbers={TP_NUMBERS} />

      {recentNotes && recentNotes.length > 0 ? (
        <div className="sheet">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Captured just now</p>
          <ul className="mt-3 flex flex-col gap-3">
            {recentNotes.map((note) => (
              <li key={note.id} className="border-b border-border-faint pb-3 text-sm last:border-none">
                <p className="text-xs font-medium text-muted">
                  {nameByTraineeId.get(note.trainee_id) ?? "Unknown"} -- TP{note.tp_number} ·{" "}
                  {new Date(note.captured_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="mt-1 text-ink">{note.text}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
