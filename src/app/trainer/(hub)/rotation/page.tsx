import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { rotationPosition, distinctTpDates, halfOwningDate } from "@/lib/rotation";
import { toLocalIso } from "@/lib/timetable-grid";
import { ReorderForm } from "@/app/trainer/(hub)/rotation/reorder-form";
import { ScheduleForm } from "@/app/trainer/(hub)/rotation/schedule-form";
import { AssignButton } from "@/app/trainer/(hub)/rotation/assign-button";
import { TpGroupBoard } from "@/app/trainer/(hub)/rotation/tp-group-board";
import { RunningOrderPanel } from "@/app/trainer/(hub)/rotation/running-order-panel";

const TP_NUMBERS = [1, 2, 3, 4, 5, 6];

export default async function TrainerRotationPage() {
  const trainer = await requireRole(["trainer", "admin"]);
  const supabase = await createClient();
  const courseId = trainer.course_id!;

  const { data: subgroups } = await supabase
    .from("course_subgroups")
    .select("id, name, tp_group_id, half_order")
    .eq("course_id", courseId)
    .order("created_at");

  const { data: tpGroups } = await supabase.from("course_tp_groups").select("id, name").eq("course_id", courseId);

  const { data: members } = await supabase
    .from("course_subgroup_members")
    .select("id, subgroup_id, trainee_id, base_slot")
    .in("subgroup_id", (subgroups ?? []).map((g) => g.id))
    .order("base_slot");

  const { data: roster } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("course_id", courseId)
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
    .eq("course_id", courseId);

  const coursebookByTpNumber = new Map((schedule ?? []).map((s) => [s.tp_number, s.tp_coursebook_id]));

  const { data: plans } = await supabase
    .from("plan_assignments")
    .select("id, trainee_id, tp_number, taught_at, rotation_position_used, main_lesson_aim, aim_type")
    .eq("course_id", courseId);

  const planByTraineeAndTp = new Map((plans ?? []).map((p) => [`${p.trainee_id}-${p.tp_number}`, p]));

  // checkpoint 3 -- real TP-day dates a paired TP group's halves alternate
  // across, derived from the actual timetable (not a stored weekday
  // setting -- see src/lib/rotation.ts).
  const { data: tpEvents } = await supabase
    .from("course_timetable_events")
    .select("event_date")
    .eq("course_id", courseId)
    .eq("type", "tp");
  const tpEventRows = tpEvents ?? [];
  const today = toLocalIso(new Date());

  const buildMembers = (subgroupId: string) =>
    (members ?? [])
      .filter((m) => m.subgroup_id === subgroupId)
      .map((m) => ({
        traineeId: m.trainee_id,
        fullName: nameByTraineeId.get(m.trainee_id) ?? "Unknown",
        baseSlot: m.base_slot,
      }));

  const paired = (subgroups ?? []).filter((g) => g.tp_group_id);
  const unpaired = (subgroups ?? []).filter((g) => !g.tp_group_id);

  return (
    <div className="flex flex-col gap-6">
      <div className="sheet p-6">
        <h1 className="font-serif text-xl text-ink">Teaching Practice rotation</h1>
        <p className="mt-2 text-muted">
          Manage each subgroup&apos;s rotation order, schedule which coursebook feeds each TP
          number, and assign a round once library content is published.
        </p>
      </div>

      {(subgroups ?? []).length === 0 ? (
        <div className="sheet p-6">
          <p className="text-muted">
            No subgroups yet. Ask your centre admin to set up subgroups on the course page.
          </p>
        </div>
      ) : null}

      {/* Paired TP groups -- the real board + running order, per checkpoint 3 */}
      {(tpGroups ?? []).map((tpGroup) => {
        const halves = paired
          .filter((g) => g.tp_group_id === tpGroup.id)
          .sort((a, b) => (a.half_order ?? 0) - (b.half_order ?? 0));
        if (halves.length !== 2) {
          // Not reachable via the admin UI today, but the DB doesn't
          // prevent it -- fall back to the plain per-subgroup board rather
          // than assuming both halves exist.
          return halves.map((g) => (
            <UnpairedSubgroupBoard
              key={g.id}
              subgroupId={g.id}
              name={g.name}
              members={buildMembers(g.id)}
              planByTraineeAndTp={planByTraineeAndTp}
            />
          ));
        }

        const boardHalves = halves.map((g) => ({
          subgroupId: g.id,
          halfOrder: g.half_order as 1 | 2,
          members: buildMembers(g.id),
        }));

        const allDates = distinctTpDates(tpEventRows);
        const nextDate = allDates.find((d) => d >= today) ?? null;
        const owningHalfOrder = nextDate ? halfOwningDate(tpEventRows, nextDate) : null;
        const nextHalf = owningHalfOrder ? boardHalves.find((h) => h.halfOrder === owningHalfOrder) : null;
        const nextHalfDateIndex = nextDate ? Math.floor(allDates.indexOf(nextDate) / 2) : -1;
        const nextTpNumber = nextHalfDateIndex + 1;

        return (
          <div key={tpGroup.id} className="flex flex-col gap-4">
            <TpGroupBoard
              groupName={tpGroup.name}
              halves={boardHalves}
              tpEvents={tpEventRows}
              plansByKey={
                new Map(
                  (plans ?? []).map((p) => [`${p.trainee_id}-${p.tp_number}`, { taughtAt: p.taught_at }])
                )
              }
              today={today}
            />

            {nextHalf && nextDate && nextTpNumber >= 1 && nextTpNumber <= 6 ? (
              <RunningOrderPanel
                subgroupId={nextHalf.subgroupId}
                halfLabel={nextHalf.halfOrder === 1 ? "A" : "B"}
                members={nextHalf.members}
                nextDate={nextDate}
                tpNumber={nextTpNumber}
                hasSchedule={coursebookByTpNumber.has(nextTpNumber) && Boolean(coursebookByTpNumber.get(nextTpNumber))}
                allPlans={(plans ?? [])
                  .filter((p) => nextHalf.members.some((m) => m.traineeId === p.trainee_id))
                  .map((p) => ({
                    traineeId: p.trainee_id,
                    tpNumber: p.tp_number,
                    taughtAt: p.taught_at,
                    rotationPositionUsed: p.rotation_position_used,
                    mainLessonAim: p.main_lesson_aim,
                    aimType: p.aim_type,
                  }))}
              />
            ) : (
              <div className="sheet p-5 text-sm text-muted">
                No upcoming TP day scheduled -- add one on the Timetable page.
              </div>
            )}
          </div>
        );
      })}

      {/* Unpaired subgroups -- unchanged, exactly as before checkpoint 3 */}
      {unpaired.map((subgroup) => (
        <UnpairedSubgroupBoard
          key={subgroup.id}
          subgroupId={subgroup.id}
          name={subgroup.name}
          members={buildMembers(subgroup.id)}
          planByTraineeAndTp={planByTraineeAndTp}
        />
      ))}

      <div className="sheet p-6">
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

// The original (pre-checkpoint-3) per-subgroup board, kept verbatim for any
// subgroup that hasn't been paired into a TP group yet -- existing courses
// must keep rendering exactly as they did before this checkpoint.
function UnpairedSubgroupBoard({
  subgroupId,
  name,
  members,
  planByTraineeAndTp,
}: {
  subgroupId: string;
  name: string;
  members: { traineeId: string; fullName: string; baseSlot: number }[];
  planByTraineeAndTp: Map<string, { taught_at: string | null }>;
}) {
  const size = members.length;

  return (
    <div className="sheet flex flex-col gap-6 p-6">
      <div>
        <h2 className="font-serif text-lg text-ink">{name}</h2>
        {size > 0 ? (
          <div className="mt-3">
            <ReorderForm subgroupId={subgroupId} members={members} />
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
                  const order = [...members].sort(
                    (a, b) => rotationPosition(a.baseSlot, size, tpNumber) - rotationPosition(b.baseSlot, size, tpNumber)
                  );
                  return (
                    <tr key={tpNumber}>
                      <td className="text-ink">TP{tpNumber}</td>
                      <td className="text-ink">{order.map((m) => m.fullName).join(", ")}</td>
                      <td>
                        <AssignButton subgroupId={subgroupId} tpNumber={tpNumber} />
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
                {members.map((member) => (
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
}
