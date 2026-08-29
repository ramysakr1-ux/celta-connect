import { notFound } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { SupervisedTaskForm } from "@/app/portfolio/[traineeId]/supervised/[eventId]/task-form";

// for-claude-code-supervised-review.md: the trainee side of a "Supervised
// review"/"[X] writing" timetable slot -- real submit-and-check structure,
// not self-study, per the spec's own reasoning (see migration 0100's
// comment). One generic response field -- the spec's own open question
// (reread-only vs reread+quiz) isn't resolved yet, this works for either.
export default async function SupervisedSessionPage({
  params,
}: {
  params: Promise<{ traineeId: string; eventId: string }>;
}) {
  const { traineeId, eventId } = await params;
  const trainee = await requireRole("trainee");
  if (trainee.id !== traineeId) notFound();

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date, event_time, type, course_id")
    .eq("id", eventId)
    .eq("type", "supervised_session")
    .maybeSingle();
  if (!event || event.course_id !== trainee.course_id) notFound();

  const { data: completion } = await supabase
    .from("supervised_session_completions")
    .select("*")
    .eq("timetable_event_id", eventId)
    .eq("trainee_id", trainee.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <BackLink href={`/portfolio/${traineeId}/timetable`} label={"Timetable"} />
      <div className="sheet">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
          {new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          {event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}
        </p>
        <h1 className="mt-1 font-serif text-xl text-ink">{event.title}</h1>
      </div>

      <SupervisedTaskForm eventId={eventId} completion={completion ?? null} />
    </div>
  );
}
