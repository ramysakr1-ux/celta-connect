import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { rotationPosition } from "@/lib/rotation";
import { ReorderForm } from "@/app/dashboard/trainer/rotation/reorder-form";
import { ScheduleForm } from "@/app/dashboard/trainer/rotation/schedule-form";
import { AssignButton } from "@/app/dashboard/trainer/rotation/assign-button";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6];

export default async function TrainerRotationPage() {
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  const { data: subgroups } = await supabase
    .from("course_subgroups")
    .select("*")
    .eq("course_id", trainer.course_id!)
    .order("created_at");

  const { data: members } = await supabase
    .from("course_subgroup_members")
    .select("id, subgroup_id, trainee_id, base_slot")
    .in("subgroup_id", (subgroups ?? []).map((g) => g.id))
    .order("base_slot");

  const { data: roster } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", trainer.course_id!)
    .eq("role", "trainee");

  const nameByTraineeId = new Map((roster ?? []).map((r) => [r.id, r.full_name]));

  const { data: coursebooks } = await supabase
    .from("tp_coursebooks")
    .select("id, title, level")
    .eq("center_id", trainer.center_id)
    .order("title");

  const { data: schedule } = await supabase
    .from("course_tp_schedule")
    .select("tp_number, tp_coursebook_id")
    .eq("course_id", trainer.course_id!);

  const coursebookByTpNumber = new Map((schedule ?? []).map((s) => [s.tp_number, s.tp_coursebook_id]));

  const { data: plans } = await supabase
    .from("plan_assignments")
    .select("id, trainee_id, tp_number, taught_at")
    .eq("course_id", trainer.course_id!);

  const planByTraineeAndTp = new Map(
    (plans ?? []).map((p) => [`${p.trainee_id}-${p.tp_number}`, p])
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Teaching Practice rotation</h1>
        <p className="mt-2 text-muted">
          Manage each subgroup&apos;s rotation order, schedule which coursebook feeds each TP
          number, and assign a round once library content is published.
        </p>
      </div>

      {(subgroups ?? []).length === 0 ? (
        <div className="card p-6">
          <p className="text-muted">
            No subgroups yet. Ask your center admin to set up subgroups on the course page.
          </p>
        </div>
      ) : null}

      {(subgroups ?? []).map((subgroup) => {
        const subgroupMembers = (members ?? [])
          .filter((m) => m.subgroup_id === subgroup.id)
          .map((m) => ({
            traineeId: m.trainee_id,
            fullName: nameByTraineeId.get(m.trainee_id) ?? "Unknown",
            baseSlot: m.base_slot,
          }));
        const size = subgroupMembers.length;

        return (
          <div key={subgroup.id} className="card flex flex-col gap-6 p-6">
            <div>
              <h2 className="font-serif text-lg text-ink">{subgroup.name}</h2>
              {size > 0 ? (
                <div className="mt-3">
                  <ReorderForm subgroupId={subgroup.id} members={subgroupMembers} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted">No trainees in this subgroup yet.</p>
              )}
            </div>

            {size > 0 ? (
              <div>
                <h3 className="text-sm text-muted">Teaching order preview</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="table-plain w-full">
                    <thead>
                      <tr>
                        <th className="text-sm text-muted">TP</th>
                        <th className="text-sm text-muted">Teaching order</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {TP_NUMBERS.map((tpNumber) => {
                        const order = [...subgroupMembers].sort(
                          (a, b) =>
                            rotationPosition(a.baseSlot, size, tpNumber) -
                            rotationPosition(b.baseSlot, size, tpNumber)
                        );
                        return (
                          <tr key={tpNumber}>
                            <td className="text-ink">TP{tpNumber}</td>
                            <td className="text-ink">{order.map((m) => m.fullName).join(", ")}</td>
                            <td>
                              <AssignButton subgroupId={subgroup.id} tpNumber={tpNumber} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {size > 0 ? (
              <div>
                <h3 className="text-sm text-muted">Progress</h3>
                <p className="mt-1 text-xs text-muted">
                  Logging a trainee&apos;s TP lesson (on their trainee page) unlocks assigning
                  their next one -- keeps the Plan page to one upcoming lesson at a time.
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="table-plain w-full">
                    <thead>
                      <tr>
                        <th className="text-sm text-muted">Trainee</th>
                        {TP_NUMBERS.map((tpNumber) => (
                          <th key={tpNumber} className="text-sm text-muted">
                            TP{tpNumber}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subgroupMembers.map((member) => (
                        <tr key={member.traineeId}>
                          <td className="text-ink">{member.fullName}</td>
                          {TP_NUMBERS.map((tpNumber) => {
                            const plan = planByTraineeAndTp.get(`${member.traineeId}-${tpNumber}`);
                            if (!plan) {
                              return (
                                <td key={tpNumber} className="text-sm text-muted">
                                  &mdash;
                                </td>
                              );
                            }
                            if (plan.taught_at) {
                              return (
                                <td key={tpNumber}>
                                  <span className="status-pill status-pill-on-track">Taught</span>
                                </td>
                              );
                            }
                            return (
                              <td key={tpNumber} className="text-sm text-muted">
                                Awaiting lesson log
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="card p-6">
        <h2 className="font-serif text-lg text-ink">Coursebook schedule</h2>
        <p className="mt-1 text-sm text-muted">
          Which coursebook&apos;s TP Points Library feeds each TP number.
        </p>
        <div className="mt-3 flex flex-col gap-3">
          {TP_NUMBERS.map((tpNumber) => (
            <ScheduleForm
              key={tpNumber}
              tpNumber={tpNumber}
              coursebooks={coursebooks ?? []}
              currentCoursebookId={coursebookByTpNumber.get(tpNumber) ?? null}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
