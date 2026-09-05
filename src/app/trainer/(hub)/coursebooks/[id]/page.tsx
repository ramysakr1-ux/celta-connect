import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { GenerateButton } from "@/components/tp-library/generate-button";
import { TpNumberTabs } from "@/components/tp-library/tp-number-tabs";
import { AdditionalSources } from "@/components/tp-library/additional-sources";
import {
  updateTpPoint,
  setTpPointStatus,
  trainerAddCoursebookSource,
  removeCoursebookSource,
} from "@/app/trainer/(hub)/coursebooks/actions";

// "Speakout B2 (Set 1)" / "Speakout B2 (Set 2)" -> "Speakout B2", so the
// avoid-repeat picker can default to pre-checking a coursebook's own
// sibling sets without the trainer having to hunt for them manually.
function baseSetTitle(title: string): string {
  return title.replace(/\s*\(set\s*\d+\)\s*$/i, "").trim().toLowerCase();
}

export default async function TrainerCoursebookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const trainer = await requireRole(["trainer", "admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: coursebook } = await supabase
    .from("tp_coursebooks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!coursebook || coursebook.center_id !== trainer.center_id) {
    notFound();
  }

  const [{ data: points }, { data: sources }, { data: otherCoursebooks }] = await Promise.all([
    supabase.from("tp_points").select("*").eq("tp_coursebook_id", id).order("tp_number").order("sequence_index"),
    supabase
      .from("tp_coursebook_sources")
      .select("*")
      .eq("tp_coursebook_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("tp_coursebooks")
      .select("id, title")
      .eq("center_id", trainer.center_id)
      .neq("id", id)
      .order("title", { ascending: true }),
  ]);

  const siblingCoursebooks = otherCoursebooks ?? [];
  const base = baseSetTitle(coursebook.title);
  const defaultAvoidIds =
    coursebook.avoid_repeat_of.length > 0
      ? coursebook.avoid_repeat_of
      : siblingCoursebooks.filter((c) => baseSetTitle(c.title) === base).map((c) => c.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet flex flex-col gap-6 p-6">
        <div>
          <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Teaching Practice</p>
          <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">
            {coursebook.title} ({coursebook.level})
          </h1>
          <p className="mt-2 text-muted">Status: {coursebook.generation_status}</p>
          {coursebook.generation_error ? (
            <p className="mt-2 text-sm text-destructive">{coursebook.generation_error}</p>
          ) : null}
        </div>

        <AdditionalSources
          coursebookId={coursebook.id}
          centerId={trainer.center_id}
          sources={sources ?? []}
          addAction={trainerAddCoursebookSource}
          removeAction={removeCoursebookSource}
        />

        {coursebook.generation_status === "pending" || coursebook.generation_status === "failed" ? (
          <GenerateButton
            coursebookId={coursebook.id}
            siblingCoursebooks={siblingCoursebooks}
            defaultAvoidIds={defaultAvoidIds}
          />
        ) : null}
      </div>

      <TpNumberTabs
        points={points ?? []}
        coursebookId={coursebook.id}
        updateAction={updateTpPoint}
        setStatusAction={setTpPointStatus}
      />
    </div>
  );
}
