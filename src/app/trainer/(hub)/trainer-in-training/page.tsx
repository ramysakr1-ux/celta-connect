import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { TitWorkspace } from "@/app/trainer/(hub)/trainer-in-training/workspace";

// specs/for-claude-code-trainer-in-training.md: the whole TinT portfolio
// workspace. Private to the training pair -- "the TinT has no official
// capacity with candidates," and that principle extends to this screen
// itself: a regular trainer who is neither the TinT nor their supervisor
// sees nothing here, same as RLS (tit_can_access(), migration 0148)
// already enforces at the data layer.
export default async function TrainerInTrainingPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  if (!trainer) redirect("/login");
  if (!trainer.course_id) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const supabase = await createClient();
  const { data: courseTutors } = await supabase
    .from("course_tutors")
    .select("id, course_id, profile_id, verified_at, supervisor_profile_id")
    .eq("course_id", trainer.course_id)
    .eq("is_trainer_in_training", true)
    .is("left_at", null);

  const relevant = (courseTutors ?? []).filter(
    (ct) => trainer.role === "admin" || ct.profile_id === trainer.id || ct.supervisor_profile_id === trainer.id
  );

  if (relevant.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">Trainer-in-Training</h1>
          <p className="mt-1 text-sm text-muted">
            Private to the trainer-in-training and their supervisor. Set someone as a trainer-in-training, with a
            verification date and a supervisor, on the Tutors panel in Centre settings.
          </p>
        </div>
        <div className="sheet text-sm text-muted">No trainer-in-training on this course involves you right now.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl text-ink">Trainer-in-Training</h1>
        <p className="mt-1 text-sm text-muted">
          Everything here is between the trainer-in-training and their supervisor -- nothing on this page ever
          reaches a candidate.
        </p>
      </div>
      {relevant.map((ct) => (
        <TitWorkspace key={ct.id} supabase={supabase} courseTutor={ct} />
      ))}
    </div>
  );
}
