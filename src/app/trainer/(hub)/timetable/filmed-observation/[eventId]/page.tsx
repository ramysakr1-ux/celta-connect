import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { FilmedObservationSetupForm } from "@/app/trainer/(hub)/timetable/filmed-observation/setup-form";
import { FilmedObservationBreaksForm } from "@/app/trainer/(hub)/timetable/filmed-observation/breaks-form";
import { FilmedObservationTaskForm } from "@/app/trainer/(hub)/timetable/filmed-observation/task-form";
import { formatCalendarDate } from "@/lib/format-date";

// design_handoff_filmed_observation_watch: setup for one "Filmed observation
// N" timetable milestone -- recording link, expected length, discussion
// breaks, and the observation task. Reached from that event's detail panel
// on the main timetable board.
export default async function FilmedObservationSetupPage({ params }: { params: Promise<{ eventId: string }> }) {
  const trainer = await requireRole(["trainer", "admin"]);
  const { eventId } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("course_timetable_events")
    .select("id, title, event_date, event_time, course_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.course_id !== trainer.course_id) notFound();

  const { data: session } = await supabase
    .from("filmed_observation_sessions")
    .select("id, lesson_title, recording_url, length_minutes, level, learner_count, teacher_name, main_aim, sub_aim")
    .eq("timetable_event_id", eventId)
    .maybeSingle();

  const [{ data: breaks }, { data: task }] = session
    ? await Promise.all([
        supabase
          .from("filmed_observation_breaks")
          .select("id, break_number, timestamp_seconds, duration_seconds, prompt")
          .eq("session_id", session.id)
          .order("break_number"),
        supabase
          .from("filmed_observation_tasks")
          .select("criteria_codes, prompt_1, prompt_2, general_prompt, rating_label, rating_options")
          .eq("session_id", session.id)
          .maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/trainer/timetable" label={"Timetable"} />

      <div className="sheet">
        <p className="text-label text-muted">Filmed observation · group watch session</p>
        <p className="text-label font-bold tracking-[0.1em] text-muted uppercase">Timetable</p>
        <h1 className="font-serif text-display leading-[1.08] font-semibold text-ink-warm">{event.title}</h1>
        <p className="mt-1 text-body text-muted">
          {formatCalendarDate(event.event_date, { day: "numeric", month: "long", weekday: "long" })}
          {event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}
        </p>
      </div>

      <div className="sheet">
        <h2 className="font-serif text-h3 text-ink">Recording &amp; details</h2>
        <p className="mt-1 text-body text-muted">
          The whole cohort watches together, in-app, at this scheduled time. Anyone who misses it can watch the same
          recording solo afterward — the observation hour isn&apos;t gated on live attendance.
        </p>
        <div className="mt-3">
          <FilmedObservationSetupForm
            eventId={eventId}
            lessonTitle={session?.lesson_title ?? null}
            recordingUrl={session?.recording_url ?? null}
            lengthMinutes={session?.length_minutes ?? null}
            level={session?.level ?? null}
            learnerCount={session?.learner_count ?? null}
            teacherName={session?.teacher_name ?? null}
            mainAim={session?.main_aim ?? null}
            subAim={session?.sub_aim ?? null}
          />
        </div>
      </div>

      {session ? (
        <>
          <div className="sheet">
            <h2 className="font-serif text-h3 text-ink">Discussion breaks</h2>
            <p className="mt-1 text-body text-muted">
              Playback auto-pauses at each timestamp with a discussion prompt and a countdown. Anyone can resume early.
            </p>
            <div className="mt-3">
              <FilmedObservationBreaksForm sessionId={session.id} breaks={breaks ?? []} />
            </div>
          </div>

          <div className="sheet">
            <h2 className="font-serif text-h3 text-ink">Observation task</h2>
            <p className="mt-1 text-body text-muted">
              Two prompts tied to the criterion this session covers, one general prompt, and a quick rating.
            </p>
            <div className="mt-3">
              <FilmedObservationTaskForm sessionId={session.id} task={task ?? null} />
            </div>
          </div>
        </>
      ) : (
        <p className="text-body text-muted">Save the recording details above to add discussion breaks and the observation task.</p>
      )}
    </div>
  );
}
