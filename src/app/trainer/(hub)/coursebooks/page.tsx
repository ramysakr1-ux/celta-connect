import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CoursebookList } from "@/components/tp-library/coursebook-list";
import { CoursebookUploadForm } from "@/components/tp-library/coursebook-upload-form";
import { trainerCreateCoursebookRecord } from "@/app/trainer/(hub)/coursebooks/actions";

export default async function TrainerCoursebooksPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();

  // Alphabetical by title -- this list is purely a browsing/editing aid
  // (find a coursebook, open it, tweak a point), unrelated to
  // course_tp_schedule/assign_tp_round which actually drive rotation and
  // trainee distribution -- reordering here has zero effect on either.
  const { data: coursebooks } = await supabase
    .from("tp_coursebooks")
    .select("*")
    .eq("center_id", trainer.center_id)
    .order("title", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet p-6">
        <h1 className="font-serif text-xl text-ink">TP Points Library</h1>
        <p className="mt-2 text-muted">
          Upload coursebook PDFs to generate a reusable bank of TP points, tiered by density band.
        </p>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Coursebooks</h2>
        <div className="mt-3">
          <CoursebookList
            coursebooks={coursebooks ?? []}
            basePath="/trainer/coursebooks"
          />
        </div>
      </div>

      <CoursebookUploadForm centerId={trainer.center_id} action={trainerCreateCoursebookRecord} />
    </div>
  );
}
