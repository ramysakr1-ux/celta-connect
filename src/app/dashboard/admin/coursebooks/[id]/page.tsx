import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { GenerateButton } from "@/components/tp-library/generate-button";
import { TpNumberTabs } from "@/components/tp-library/tp-number-tabs";
import { updateTpPoint, setTpPointStatus } from "@/app/dashboard/admin/coursebooks/actions";

export default async function AdminCoursebookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireRole("admin");
  const { id } = await params;
  const supabase = await createClient();

  const { data: coursebook } = await supabase
    .from("tp_coursebooks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!coursebook || coursebook.center_id !== admin.center_id) {
    notFound();
  }

  const { data: points } = await supabase
    .from("tp_points")
    .select("*")
    .eq("tp_coursebook_id", id)
    .order("tp_number")
    .order("sequence_index");

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">
          {coursebook.title} ({coursebook.level})
        </h1>
        <p className="mt-2 text-muted">Status: {coursebook.generation_status}</p>
        {coursebook.generation_error ? (
          <p className="mt-2 text-sm text-destructive">{coursebook.generation_error}</p>
        ) : null}
        {coursebook.generation_status === "pending" || coursebook.generation_status === "failed" ? (
          <div className="mt-4">
            <GenerateButton coursebookId={coursebook.id} />
          </div>
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
