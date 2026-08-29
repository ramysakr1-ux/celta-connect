import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { CRITERIA_LABELS } from "@/lib/celta-criteria";
import { TaskResponseForm } from "@/app/portfolio/[traineeId]/filmed-observation/[sessionId]/task/task-response-form";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function FilmedObservationTaskPage({
  params,
}: {
  params: Promise<{ traineeId: string; sessionId: string }>;
}) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId, sessionId } = await params;
  const supabase = await createClient();

  const { data: fSession } = await supabase
    .from("filmed_observation_sessions")
    .select("id, lesson_title, level, learner_count, length_minutes")
    .eq("id", sessionId)
    .maybeSingle();
  if (!fSession) notFound();

  const { data: task } = await supabase
    .from("filmed_observation_tasks")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (!task) notFound();

  const { data: response } = await supabase
    .from("filmed_observation_task_responses")
    .select("*")
    .eq("task_id", task.id)
    .eq("trainee_id", session.profile.id)
    .maybeSingle();

  const notes = Array.isArray(response?.timestamped_notes)
    ? (response.timestamped_notes as { timestamp_seconds: number; note: string }[])
    : [];
  const completed = Boolean(response?.completed_at);

  // Decorative teal/garnet alternation down this stack of plain sheets --
  // no status meaning of its own, same rule as everywhere else. A counter
  // (not a literal index) so it still alternates correctly whether or not
  // the criteria-codes sheet below actually renders.
  let sheetCounter = 0;
  const nextSheetGarnet = () => sheetCounter++ % 2 === 1;

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/portfolio/${traineeId}/filmed-observation/${sessionId}`} label={"Back to the session"} />

      <div className={`sheet flex flex-col gap-1 ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
        <h1 className="font-serif text-xl text-ink">{fSession.lesson_title ?? "Filmed lesson"}</h1>
        <p className="text-sm text-muted">
          {[fSession.level, fSession.learner_count ? `${fSession.learner_count} learners` : null, fSession.length_minutes ? `${fSession.length_minutes} min` : null]
            .filter(Boolean)
            .join(" · ") || "Details not set yet"}
        </p>
      </div>

      {task.criteria_codes.length > 0 ? (
        <div className={`sheet flex flex-col gap-1 ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Input session this week</p>
          <p className="text-sm text-ink">
            {task.criteria_codes.map((c) => `${c} · ${CRITERIA_LABELS[c] ?? c}`).join(" · ")}
          </p>
        </div>
      ) : null}

      <div className={`sheet flex flex-col gap-4 ${nextSheetGarnet() ? "sheet-garnet" : ""}`}>
        <TaskResponseForm
          taskId={task.id}
          prompt1={task.prompt_1}
          prompt2={task.prompt_2}
          generalPrompt={task.general_prompt}
          ratingLabel={task.rating_label}
          ratingOptions={task.rating_options}
          response1={response?.response_1 ?? ""}
          response2={response?.response_2 ?? ""}
          responseGeneral={response?.response_general ?? ""}
          rating={response?.rating ?? ""}
          completed={completed}
          sessionId={sessionId}
        />

        <div className="border-t border-border-faint pt-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Notes against the recording</p>
          {notes.length === 0 ? (
            <p className="mt-1.5 text-sm text-muted">Add quick notes while you watch — they&apos;ll show up here.</p>
          ) : (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {notes
                .slice()
                .sort((a, b) => a.timestamp_seconds - b.timestamp_seconds)
                .map((n, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Link
                      href={`/portfolio/${traineeId}/filmed-observation/${sessionId}?t=${n.timestamp_seconds}`}
                      className="shrink-0 rounded-[4px] bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline"
                    >
                      {formatClock(n.timestamp_seconds)}
                    </Link>
                    <p className="text-sm text-ink">{n.note}</p>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
