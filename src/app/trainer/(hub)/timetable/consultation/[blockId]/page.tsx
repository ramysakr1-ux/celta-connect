import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { ordinal } from "@/lib/stage2-tutorials";
import { updateConsultationDuration } from "@/app/trainer/(hub)/timetable/consultation-actions";
import { PageHead } from "@/app/trainer/(hub)/page-head";
import { BackLink } from "@/components/back-link";
import { Avatar } from "@/components/avatar";
import { shortDate, shortTime } from "@/lib/tutorials-section";

// A consultation sheet, tutor side (design_handoff_tutorials_consultations,
// "Opened sheet"): ordinal · time · who, or "Open". Same shape as the Stage
// 2 sheet -- the candidate books the next open position, the sheet is the
// source of truth, nothing pings per booking.
export default async function ConsultationBlockPage({ params }: { params: Promise<{ blockId: string }> }) {
  const trainer = await requireRole(["trainer", "admin"]);
  const { blockId } = await params;
  const supabase = await createClient();

  const { data: block } = await supabase.from("consultation_blocks").select("*").eq("id", blockId).maybeSingle();
  if (!block || block.course_id !== trainer.course_id) notFound();

  const [{ data: event }, { data: slots }, { data: tutor }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date, event_time").eq("id", block.timetable_event_id).maybeSingle(),
    supabase.from("consultation_slots").select("id, position, trainee_id, assignment_type").eq("block_id", blockId).order("position"),
    supabase.from("profiles").select("full_name").eq("id", block.tutor_profile_id).maybeSingle(),
  ]);
  const traineeIds = (slots ?? []).map((s) => s.trainee_id).filter((id): id is string => !!id);
  const { data: trainees } = traineeIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", traineeIds) : { data: [] };
  const nameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));

  const mine = block.tutor_profile_id === trainer.id;
  const booked = (slots ?? []).filter((s) => s.trainee_id).length;
  const total = (slots ?? []).length;
  const slotMinutes = block.slot_length_minutes;
  const startMinutes = event?.event_time ? Number(event.event_time.slice(0, 2)) * 60 + Number(event.event_time.slice(3, 5)) : 0;
  const timeAt = (position: number) => {
    const m = startMinutes + (position - 1) * slotMinutes;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  const full = total > 0 && booked === total;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/trainer/timetable" label="Timetable" />
      <PageHead
        eyebrow="Timetable · consultation sheet"
        title={mine ? "Your consultation sheet" : `Consultation sheet · ${tutor?.full_name ?? "tutor"}`}
        lede={`${event ? `${shortDate(event.event_date)} · ${shortTime(event.event_time)}` : ""} · ${total} position${total === 1 ? "" : "s"} of ${slotMinutes} min. The candidate books the next open position; this sheet is the source of truth, nothing pings per booking.`}
      />

      {/* The accent tint for every sheet, in the viewer's role colour (Ramy, 5 Sep 2026: "go with the ACT's"). */}
      <div
        className="flex flex-col gap-3.5 rounded-[14px] border-[1.5px] px-6 py-5"
        style={{ background: "color-mix(in oklab, var(--hub-accent) 9%, var(--color-card))", borderColor: "var(--hub-accent)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 className="font-serif text-[20px] font-semibold text-ink-warm">Positions</h2>
            {mine ? (
              <span className="rounded-full px-[7px] py-[2px] text-[10px] font-bold tracking-[0.06em] text-primary-foreground uppercase" style={{ background: "var(--hub-accent)" }}>
                Yours
              </span>
            ) : null}
          </div>
          <span
            className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[12px] font-bold whitespace-nowrap"
            style={full ? { background: "oklch(93% 0.019 190)", color: "oklch(32% 0.05 195)" } : booked === 0 ? { background: "oklch(93.5% 0.008 85)", color: "oklch(38% 0.014 70)" } : { background: "oklch(93% 0.05 80)", color: "oklch(40% 0.09 68)" }}
          >
            <span className="block size-1.5 rounded-full bg-current" />
            {booked} of {total} booked
          </span>
        </div>
        <div className="flex flex-col">
          {(slots ?? []).map((s) => (
            <div key={s.id} className="grid grid-cols-[44px_56px_1fr_auto] items-center gap-3.5 border-t border-border-faint py-2.5">
              <span className="text-[11px] font-bold tracking-[0.08em] text-muted uppercase">{ordinal(s.position)}</span>
              <span className="text-[14px] font-semibold tabular-nums text-ink">{timeAt(s.position)}</span>
              {s.trainee_id ? (
                <span className="flex items-center gap-2.5">
                  <Avatar name={nameById.get(s.trainee_id) ?? "?"} size="xs" />
                  <span className="text-[13.5px] font-semibold text-ink">{nameById.get(s.trainee_id) ?? "Unknown"}</span>
                  {s.assignment_type ? <span className="text-[12px] text-muted">· about {s.assignment_type}</span> : null}
                </span>
              ) : (
                <span className="flex items-center gap-2.5">
                  <span className="block size-7 rounded-[8px] border-[1.5px] border-dashed border-[oklch(80%_0.014_82)]" />
                  <span className="text-[13.5px] text-muted italic">Open</span>
                </span>
              )}
              <span
                className="inline-flex h-6 items-center gap-1.5 rounded-full px-[9px] text-[11px] font-bold"
                style={s.trainee_id ? { background: "oklch(93% 0.019 190)", color: "oklch(32% 0.05 195)" } : { background: "oklch(93.5% 0.008 85)", color: "oklch(38% 0.014 70)" }}
              >
                <span className="block size-1.5 rounded-full bg-current" />
                {s.trainee_id ? "Booked" : "Open"}
              </span>
            </div>
          ))}
          {total === 0 ? <p className="py-2 text-sm text-muted">No positions yet.</p> : null}
        </div>
      </div>

      <div className="sheet flex flex-col gap-2 px-6 py-5">
        <h2 className="font-serif text-[20px] font-semibold text-ink-warm">Adjust length</h2>
        <p className="text-[12.5px] text-muted">Too short? Lengthen it -- unbooked positions regenerate, anyone already booked keeps their position.</p>
        <form action={updateConsultationDuration} className="mt-1 flex items-center gap-2">
          <input type="hidden" name="block_id" value={blockId} />
          <input
            name="duration_minutes"
            type="number"
            min={15}
            step={15}
            defaultValue={total * slotMinutes}
            className="h-9 w-32 rounded-[8px] border border-border bg-card px-3 text-[13px] text-ink outline-none focus:border-primary"
          />
          <button type="submit" className="trainer-hover-fill h-9 rounded-[8px] border border-border bg-card px-3.5 text-[12.5px] font-semibold text-ink">
            Update
          </button>
        </form>
      </div>
    </div>
  );
}
