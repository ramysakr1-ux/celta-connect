import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { TpForm } from "@/app/dashboard/trainer/trainees/[id]/tp-form";
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

  const [{ data: tps }, { data: assignments }] = await Promise.all([
    supabase.from("tps").select("*").eq("trainee_id", id).order("tp_number"),
    supabase.from("assignments").select("*").eq("trainee_id", id).order("assignment_type"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">{trainee.full_name}</h1>
        <p className="mt-1 text-muted">{trainee.email}</p>
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
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tps?.map((tp) => (
            <TpForm key={`${tp.id}-${tp.updated_at}`} tp={tp} />
          ))}
        </div>
      </div>
    </div>
  );
}
