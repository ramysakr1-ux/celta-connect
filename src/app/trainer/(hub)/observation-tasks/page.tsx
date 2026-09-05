import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CreateTaskForm } from "@/app/trainer/(hub)/observation-tasks/create-task-form";
import { deleteObservationTask } from "@/app/trainer/(hub)/observation-tasks/actions";

// Observation Tasks -- "directed, assignable, submittable" observation
// activities, replacing the bare self-reported log as the trainer-facing
// way to require a specific observation. Assigned to the whole cohort (no
// per-trainee assignment model exists elsewhere in the app to reuse, and
// the 6-hour requirement is a whole-cohort, per-trainee thing anyway).
// Roster's "Obs. tasks" column is the at-a-glance summary; this page is
// where a trainer creates tasks and reads real submission text.
export default async function ObservationTasksPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  const supabase = await createClient();
  const [{ data: tasks }, { data: trainees }] = await Promise.all([
    supabase
      .from("observation_tasks")
      .select("id, title, instructions, created_at")
      .eq("course_id", trainer.course_id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").eq("course_id", trainer.course_id).eq("role", "trainee").order("full_name"),
  ]);

  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: submissions } =
    taskIds.length > 0
      ? await supabase
          .from("observation_task_submissions")
          .select("task_id, trainee_id, response, submitted_at")
          .in("task_id", taskIds)
      : { data: [] };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Observation tasks</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">{(tasks ?? []).length} assigned</h1>
        <p className="mt-1 text-sm text-muted">
          Directed observation tasks for the whole cohort. A submission counts toward each candidate&apos;s 6-hour
          requirement the same way a self-logged observation does.
        </p>
      </div>

      <div className="sheet">
        <h2 className="font-serif text-lg text-ink">Assign a new task</h2>
        <div className="mt-3">
          <CreateTaskForm />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {(tasks ?? []).length === 0 ? (
          <div className="sheet text-sm text-muted">No observation tasks assigned yet.</div>
        ) : (
          (tasks ?? []).map((task) => {
            const taskSubmissions = (submissions ?? []).filter((s) => s.task_id === task.id);
            const submittedByTrainee = new Map(taskSubmissions.map((s) => [s.trainee_id, s]));
            return (
              <div key={task.id} className="sheet flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-lg text-ink">{task.title}</h3>
                    <p className="mt-1 text-sm text-muted">{task.instructions}</p>
                  </div>
                  <form action={deleteObservationTask}>
                    <input type="hidden" name="task_id" value={task.id} />
                    <button type="submit" className="shrink-0 text-xs text-muted hover:text-destructive">
                      Delete
                    </button>
                  </form>
                </div>
                <div className="flex flex-col divide-y divide-border-faint">
                  {(trainees ?? []).map((trainee) => {
                    const submission = submittedByTrainee.get(trainee.id);
                    return (
                      <details key={trainee.id} className="py-2">
                        <summary className="flex cursor-pointer items-center justify-between gap-3">
                          <span className="text-sm text-ink">{trainee.full_name}</span>
                          <span className={`pill ${submission ? "pill-success" : "pill-neutral"}`}>
                            {submission ? "Submitted" : "Not yet"}
                          </span>
                        </summary>
                        {submission ? (
                          <div className="mt-2 pl-1">
                            <p className="text-xs text-muted">{new Date(submission.submitted_at).toLocaleString()}</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{submission.response}</p>
                          </div>
                        ) : null}
                      </details>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
