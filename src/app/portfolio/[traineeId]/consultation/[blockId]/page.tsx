import { BackLink } from "@/components/back-link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ordinal } from "@/lib/stage2-tutorials";
import { BookConsultationButton } from "@/app/portfolio/[traineeId]/consultation/[blockId]/book-consultation-button";
import { releaseConsultationSlot } from "@/app/trainer/(hub)/timetable/consultation-actions";
import { shortDate, shortTime } from "@/lib/tutorials-section";

// Candidate side of a consultation sheet (migration 0275). Visibility is
// RLS's: a candidate sees every block on their own course. Whether they
// may book THIS one is the action's rule (build-spec.md rule 15), and the
// page says which way it will go before they try.
export default async function TraineeConsultationPage({ params }: { params: Promise<{ traineeId: string; blockId: string }> }) {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const { traineeId, blockId } = await params;
  const supabase = await createClient();

  const { data: block } = await supabase.from("consultation_blocks").select("*").eq("id", blockId).maybeSingle();
  if (!block) notFound();

  const myProfileId = session.profile.id;
  const admin = createAdminClient();
  const [{ data: event }, { data: slots }, { data: tutor }, { data: assignments }, { data: membership }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date, event_time").eq("id", block.timetable_event_id).maybeSingle(),
    supabase.from("consultation_slots").select("id, position, trainee_id").eq("block_id", blockId).order("position"),
    supabase.from("profiles").select("full_name").eq("id", block.tutor_profile_id).maybeSingle(),
    supabase.from("assignments").select("assignment_type").eq("trainee_id", myProfileId).eq("course_id", block.course_id),
    admin.from("course_subgroup_members").select("course_subgroups!inner(tp_group_id)").eq("trainee_id", myProfileId).maybeSingle(),
  ]);
  const tpGroupId = (membership as { course_subgroups?: { tp_group_id: string | null } | null } | null)?.course_subgroups?.tp_group_id ?? null;
  const { data: group } = tpGroupId ? await admin.from("course_tp_groups").select("tutor_profile_id").eq("id", tpGroupId).maybeSingle() : { data: null };
  const ownTutor = group?.tutor_profile_id === block.tutor_profile_id;

  const traineeIds = (slots ?? []).map((s) => s.trainee_id).filter((id): id is string => !!id);
  const { data: trainees } = traineeIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", traineeIds) : { data: [] };
  const nameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));

  const mySlots = (slots ?? []).filter((s) => s.trainee_id === myProfileId);
  const hasOpenSlot = (slots ?? []).some((s) => !s.trainee_id);
  const slotMinutes = block.slot_length_minutes;
  const startMinutes = event?.event_time ? Number(event.event_time.slice(0, 2)) * 60 + Number(event.event_time.slice(3, 5)) : 0;
  const timeAt = (position: number) => {
    const m = startMinutes + (position - 1) * slotMinutes;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={`/portfolio/${traineeId}/timetable`} label="Timetable" />

      <div className="sheet">
        <p className="text-xs text-muted">Consultation</p>
        <h1 className="font-serif text-xl text-ink">
          {tutor?.full_name ?? "Your tutor"} · {event ? `${shortDate(event.event_date)} ${shortTime(event.event_time)}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Positions of {slotMinutes} minutes, in order from {shortTime(event?.event_time)}. Book one if you want to talk something through --
          an assignment, a lesson, anything on the course. Release it if your plans change.
        </p>
      </div>

      <div className="sheet sheet-garnet">
        <div className="flex flex-col">
          {(slots ?? []).map((s, i) => {
            const isMine = s.trainee_id === myProfileId;
            return (
              <div key={s.id} className={`flex items-center justify-between py-2.5 ${i > 0 ? "border-t border-border-faint" : ""}`}>
                <span className="text-sm text-ink">
                  {ordinal(s.position)} <span className="text-muted">· {timeAt(s.position)}</span>
                </span>
                {s.trainee_id ? (
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${isMine ? "font-semibold text-primary" : "text-muted"}`}>{isMine ? "You" : (nameById.get(s.trainee_id) ?? "Booked")}</span>
                    {isMine ? (
                      <form action={releaseConsultationSlot}>
                        <input type="hidden" name="slot_id" value={s.id} />
                        <input type="hidden" name="block_id" value={blockId} />
                        <button type="submit" className="text-xs text-destructive hover:underline">
                          Release
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-sm text-muted">Open</span>
                )}
              </div>
            );
          })}
          {(slots ?? []).length === 0 ? <p className="py-2 text-sm text-muted">No positions yet.</p> : null}
        </div>
      </div>

      {hasOpenSlot ? (
        <BookConsultationButton blockId={blockId} assignments={(assignments ?? []).map((a) => a.assignment_type)} ownTutor={ownTutor} />
      ) : mySlots.length === 0 ? (
        <p className="text-sm text-muted">No open positions left on this sheet.</p>
      ) : null}
    </div>
  );
}
