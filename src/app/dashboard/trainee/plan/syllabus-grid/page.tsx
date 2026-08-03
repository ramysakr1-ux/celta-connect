import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { rotationPosition } from "@/lib/rotation";
import { SyllabusEntryForm } from "@/app/dashboard/trainee/plan/syllabus-grid/entry-form";

const TP_NUMBERS = [7, 8] as const;

// The self-select topic grid for TP7/8 -- unlike TP1-6, nothing is
// rotation-assigned here; trainees pick their own aim/material and this
// page just makes the whole subgroup's picks visible at once, with a soft
// warning (never a hard block) if two trainees land on the same material.
// See migration 0025 and project_tp_points_library_spec memory.
export default async function SyllabusPlanningGridPage() {
  const trainee = await requireRole("trainee");
  const supabase = await createClient();

  const { data: myMembership } = await supabase
    .from("course_subgroup_members")
    .select("subgroup_id, base_slot")
    .eq("trainee_id", trainee.id)
    .maybeSingle();

  if (!myMembership) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card p-6">
          <h1 className="font-serif text-xl text-ink">Syllabus planning grid</h1>
          <p className="mt-2 text-muted">
            You haven&apos;t been placed in a teaching-practice subgroup yet -- ask your trainer.
          </p>
        </div>
      </div>
    );
  }

  const [{ data: members }, { data: myPlans }] = await Promise.all([
    supabase
      .from("course_subgroup_members")
      .select("trainee_id, base_slot")
      .eq("subgroup_id", myMembership.subgroup_id)
      .order("base_slot"),
    supabase
      .from("tp_plans")
      .select("tp_number, submitted_at")
      .eq("trainee_id", trainee.id)
      .in("tp_number", TP_NUMBERS),
  ]);

  const memberIds = (members ?? []).map((m) => m.trainee_id);
  const subgroupSize = memberIds.length;

  const [{ data: profiles }, { data: entries }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", memberIds),
    supabase
      .from("syllabus_planning_entries")
      .select("*")
      .in("trainee_id", memberIds)
      .in("tp_number", TP_NUMBERS),
  ]);

  const nameByTraineeId = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const lockedByTp = new Map((myPlans ?? []).map((p) => [p.tp_number, Boolean(p.submitted_at)]));
  const entryByKey = new Map((entries ?? []).map((e) => [`${e.trainee_id}-${e.tp_number}`, e]));

  // Soft-conflict detection: same non-empty material text (case/space
  // insensitive) picked by more than one trainee for the same TP.
  const clashingKeys = new Set<string>();
  for (const tpNumber of TP_NUMBERS) {
    const byMaterial = new Map<string, string[]>();
    for (const e of entries ?? []) {
      if (e.tp_number !== tpNumber || !e.material.trim()) continue;
      const norm = e.material.trim().toLowerCase();
      byMaterial.set(norm, [...(byMaterial.get(norm) ?? []), e.trainee_id]);
    }
    for (const traineeIds of byMaterial.values()) {
      if (traineeIds.length > 1) {
        for (const id of traineeIds) clashingKeys.add(`${id}-${tpNumber}`);
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">Syllabus planning grid</h1>
          <p className="mt-2 text-muted">
            For TP7 and TP8 you choose your own aim and material -- everyone in your subgroup can see the
            whole grid so you don&apos;t land on the same material as someone else.
          </p>
        </div>
        <Link
          href="/dashboard/trainee/plan"
          className="shrink-0 rounded-[6px] border border-border px-4 py-2 text-sm text-ink hover:border-primary"
        >
          Lesson plans
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {(members ?? []).map((member) => {
          const isMe = member.trainee_id === trainee.id;
          const name = isMe ? "You" : nameByTraineeId.get(member.trainee_id) ?? "Trainee";

          return (
            <div key={member.trainee_id} className="card p-4">
              <h2 className="font-serif text-lg text-ink">{name}</h2>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {TP_NUMBERS.map((tpNumber) => {
                  const entry = entryByKey.get(`${member.trainee_id}-${tpNumber}`);
                  const turn = rotationPosition(member.base_slot, subgroupSize, tpNumber) + 1;
                  const clash = clashingKeys.has(`${member.trainee_id}-${tpNumber}`);

                  return (
                    <div key={tpNumber} className="rounded-[6px] border border-border-faint p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-ink">TP{tpNumber}</p>
                        <span className="text-xs text-muted">Teaches {turn}{turn === 1 ? "st" : turn === 2 ? "nd" : turn === 3 ? "rd" : "th"}</span>
                      </div>

                      {isMe ? (
                        <div className="mt-2">
                          <SyllabusEntryForm
                            tpNumber={tpNumber}
                            mainAim={entry?.main_aim ?? null}
                            subAim={entry?.sub_aim ?? null}
                            material={entry?.material ?? null}
                            locked={lockedByTp.get(tpNumber) ?? false}
                          />
                        </div>
                      ) : entry ? (
                        <div className="mt-2 flex flex-col gap-1 text-sm">
                          <p className="text-ink">{entry.main_aim}</p>
                          {entry.sub_aim ? <p className="text-muted">{entry.sub_aim}</p> : null}
                          <p className="text-muted">Material: {entry.material}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted">Not picked yet.</p>
                      )}

                      {clash ? (
                        <p className="mt-2 text-xs text-status-pending-text">
                          Same material as someone else in your group -- worth checking with them.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
