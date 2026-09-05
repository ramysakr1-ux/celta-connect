import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { ordinal, STAGE2_SLOT_LENGTH_MINUTES } from "@/lib/stage2-tutorials";
import { updateStage2Duration } from "@/app/trainer/(hub)/timetable/stage2-actions";
import { PageHead } from "@/app/trainer/(hub)/page-head";
import { BackLink } from "@/components/back-link";
import { Avatar } from "@/components/avatar";
import { shortDate, shortTime } from "@/lib/tutorials-section";

// A Stage 2 booking sheet, tutor side. Same page shape as the consultation
// sheet (timetable/consultation/[blockId]) -- Ramy, 5 Sep 2026: "keep it
// consistent across the board." Ordinal · time · who, or "Open"; the
// candidate books the next open position, the sheet is the source of
// truth, nothing pings per booking.
export default async function Stage2BlockPage({ params }: { params: Promise<{ blockId: string }> }) {
  const trainer = await requireRole(["trainer", "admin"]);
  const { blockId } = await params;
  const supabase = await createClient();

  const { data: block } = await supabase.from("stage2_tutorial_blocks").select("*").eq("id", blockId).maybeSingle();
  if (!block || block.course_id !== trainer.course_id) notFound();

  const [{ data: event }, { data: slots }, { data: tpGroup }, { data: subgroup }] = await Promise.all([
    supabase.from("course_timetable_events").select("event_date, event_time").eq("id", block.timetable_event_id).maybeSingle(),
    supabase.from("stage2_tutorial_slots").select("id, position, trainee_id").eq("block_id", blockId).order("position"),
    block.tp_group_id ? supabase.from("course_tp_groups").select("name, tutor_profile_id").eq("id", block.tp_group_id).maybeSingle() : Promise.resolve({ data: null }),
    block.subgroup_id ? supabase.from("course_subgroups").select("name").eq("id", block.subgroup_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const traineeIds = (slots ?? []).map((s) => s.trainee_id).filter((id): id is string => !!id);
  const { data: trainees } = traineeIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", traineeIds) : { data: [] };
  const nameById = new Map((trainees ?? []).map((t) => [t.id, t.full_name]));

  const groupName = tpGroup?.name ?? subgroup?.name ?? "group";
  const mine = tpGroup?.tutor_profile_id === trainer.id;
  const booked = (slots ?? []).filter((s) => s.trainee_id).length;
  const total = (slots ?? []).length;
  const slotMinutes = STAGE2_SLOT_LENGTH_MINUTES;
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
        eyebrow="Timetable · Stage 2 sheet"
        title={`Stage 2 tutorials · ${groupName}`}
        lede={`${event ? `${shortDate(event.event_date)} · ${shortTime(event.event_time)}` : ""} · ${total} position${total === 1 ? "" : "s"} of about ${slotMinutes}–20 min, running a few minutes over is normal. Each candidate books the next open position, one booking each, and can release it back to open. Only this group sees this sheet; one announcement went out when it was placed, none per booking.`}
      />

      <div
        className="flex flex-col gap-3.5 rounded-[14px] border-[1.5px] px-6 py-5"
        style={mine ? { background: "color-mix(in oklab, var(--hub-accent) 9%, var(--color-card))", borderColor: "var(--hub-accent)" } : { background: "var(--color-card)", borderColor: "var(--color-border)" }}
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
        <form action={updateStage2Duration} className="mt-1 flex items-center gap-2">
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
