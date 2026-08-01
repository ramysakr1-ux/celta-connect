import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { TpLessonForm } from "@/app/dashboard/trainer/trainees/[id]/tp-lesson-form";
import { AssignmentForm } from "@/app/dashboard/trainer/trainees/[id]/assignment-form";

export default async function TraineeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!trainee || trainee.course_id !== trainer.course_id || trainee.role !== "trainee") {
    notFound();
  }

  const [{ data: lessons }, { data: assignments }] = await Promise.all([
    supabase
      .from("tp_lessons")
      .select("*")
      .eq("trainee_id", id)
      .order("lesson_date", { ascending: false, nullsFirst: false }),
    supabase.from("assignments").select("*").eq("trainee_id", id).order("assignment_type"),
  ]);

  const lessonIds = (lessons ?? []).map((l) => l.id);
  const { data: tags } =
    lessonIds.length > 0
      ? await supabase.from("tp_lesson_criteria_tags").select("*").in("tp_lesson_id", lessonIds)
      : { data: [] };
  const tagsByLesson = new Map<string, typeof tags>();
  for (const tag of tags ?? []) {
    const list = tagsByLesson.get(tag.tp_lesson_id) ?? [];
    list.push(tag);
    tagsByLesson.set(tag.tp_lesson_id, list);
  }

  const totalMinutes = (lessons ?? []).reduce((sum, l) => sum + (l.length_minutes ?? 0), 0);
  const levels = new Set((lessons ?? []).map((l) => l.level).filter(Boolean));

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">{trainee.full_name}</h1>
          <p className="mt-1 text-muted">{trainee.email}</p>
        </div>
        <Link
          href={`/dashboard/trainer/trainees/${id}/celta5`}
          className="rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          CELTA 5 record
        </Link>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Assignments</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {assignments?.map((assignment) => (
            <AssignmentForm
              key={`${assignment.id}-${assignment.updated_at}`}
              assignment={assignment}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Teaching Practice</h2>
        <p className="mt-1 text-sm text-muted">
          {(totalMinutes / 60).toFixed(1)} hours taught across {levels.size} level
          {levels.size === 1 ? "" : "s"} (6 hours across 2+ levels required).
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {lessons?.map((lesson) => (
            <TpLessonForm
              key={`${lesson.id}-${lesson.updated_at}`}
              traineeId={id}
              lesson={lesson}
              tags={tagsByLesson.get(lesson.id) ?? []}
            />
          ))}
          <TpLessonForm traineeId={id} />
        </div>
      </div>
    </div>
  );
}
