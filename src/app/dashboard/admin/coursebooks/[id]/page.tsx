import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { GenerateButton } from "@/components/tp-library/generate-button";
import { TpNumberTabs } from "@/components/tp-library/tp-number-tabs";
import { updateTpPoint, setTpPointStatus } from "@/app/dashboard/admin/coursebooks/actions";
import { holdsCentre } from "@/lib/branch-scope";
import { RoomHead } from "@/components/room-head";

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

  if (!coursebook || !(await holdsCentre(admin, coursebook.center_id))) {
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
      <RoomHead
        eyebrow="Course admin &middot; TP points library"
        title={`${coursebook.title} (${coursebook.level})`}
        lede={`Status: ${coursebook.generation_status}`}
      >
        {coursebook.generation_status === "pending" || coursebook.generation_status === "failed" ? (
          <GenerateButton coursebookId={coursebook.id} />
        ) : null}
      </RoomHead>
      {coursebook.generation_error ? (
        <p className="text-sm text-destructive">{coursebook.generation_error}</p>
      ) : null}

      <TpNumberTabs
        points={points ?? []}
        coursebookId={coursebook.id}
        updateAction={updateTpPoint}
        setStatusAction={setTpPointStatus}
      />
    </div>
  );
}
