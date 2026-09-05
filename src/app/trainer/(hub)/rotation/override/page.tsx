import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { OverrideForm } from "@/app/trainer/(hub)/rotation/override/override-form";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6];

// master-backlog "Manual TP-point override" -- a per-trainee escape hatch
// from assign_tp_round's rotation formula. Concrete case from the spec:
// a trainee who struggled with a grammar-focused lesson should get
// *another* grammar-focused point next round, not whatever the rotation
// position happens to land on.
export default async function TpPointOverridePage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();
  const courseId = trainer.course_id!;

  const [{ data: trainees }, { data: schedule }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("course_id", courseId).eq("role", "trainee").order("full_name"),
    supabase.from("course_tp_schedule").select("tp_number, tp_coursebook_id").eq("course_id", courseId),
  ]);

  const coursebookIds = (schedule ?? []).map((s) => s.tp_coursebook_id).filter((id): id is string => Boolean(id));
  const { data: points } =
    coursebookIds.length > 0
      ? await supabase
          .from("tp_points")
          .select("id, tp_number, tp_coursebook_id, main_lesson_aim, sub_aim, short_title, aim_type, density_tier")
          .in("tp_coursebook_id", coursebookIds)
          .eq("status", "published")
          .order("tp_number")
          .order("sequence_index")
      : { data: [] };

  const tpNumbersWithSchedule = new Set((schedule ?? []).filter((s) => s.tp_coursebook_id).map((s) => s.tp_number));

  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/trainer/rotation" label={"Rotation"} />

      <div className="sheet p-6">
        <p className="text-[11.5px] font-bold tracking-[0.1em] text-muted uppercase">Teaching Practice</p>
        <h1 className="font-serif text-[34px] leading-[1.08] font-semibold text-ink-warm">Manual TP-point override</h1>
        <p className="mt-2 text-muted">
          Assign a specific published TP point to one trainee directly, bypassing the rotation
          formula -- e.g. reassigning a similarly-themed point after a fail. Only available for a
          TP the trainee hasn&apos;t taught yet.
        </p>
      </div>

      {(trainees ?? []).length === 0 ? (
        <div className="sheet p-6">
          <p className="text-muted">No trainees on this course yet.</p>
        </div>
      ) : (
        <OverrideForm
          trainees={trainees ?? []}
          tpNumbers={TP_NUMBERS}
          scheduledTpNumbers={[...tpNumbersWithSchedule]}
          points={points ?? []}
        />
      )}
    </div>
  );
}
