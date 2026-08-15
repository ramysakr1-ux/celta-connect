"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/require-role";
import { slotCountFromDuration } from "@/lib/stage2-tutorials";

export interface FormState {
  error: string | null;
}

// Setup: places the block on the timetable (a plain milestone event, same
// tag-not-new-type convention as "consultation"), creates the block +
// initial open slots, and fires the one per-group announcement -- all in
// one action, matching the spec's single "tutor places a block" step.
export async function createStage2Block(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const scopeValue = formData.get("scope") as string | null; // "subgroup:<id>" or "tpgroup:<id>"
  const eventDate = formData.get("event_date") as string | null;
  const eventTime = formData.get("event_time") as string | null;
  const durationRaw = formData.get("duration_minutes") as string | null;
  const groupLabel = (formData.get("group_label") as string | null) ?? "your group";

  if (!scopeValue || !eventDate || !eventTime || !durationRaw) {
    return { error: "Fill in the group, date, start time, and duration." };
  }
  const duration = Number(durationRaw);
  if (Number.isNaN(duration) || duration < 15) return { error: "Duration must be at least 15 minutes." };

  const [scopeKind, scopeId] = scopeValue.split(":");
  if ((scopeKind !== "subgroup" && scopeKind !== "tpgroup") || !scopeId) return { error: "Choose a group." };

  const supabase = await createClient();
  const courseId = trainer.course_id;

  const { data: event, error: eventError } = await supabase
    .from("course_timetable_events")
    .insert({
      course_id: courseId,
      type: "milestone",
      tag: "stage2_tutorial",
      title: `Stage 2 tutorials — ${groupLabel}`,
      event_date: eventDate,
      event_time: eventTime,
      created_by: trainer.id,
    })
    .select("id")
    .single();
  if (eventError || !event) return { error: "Could not add the timetable slot." };

  const { data: block, error: blockError } = await supabase
    .from("stage2_tutorial_blocks")
    .insert({
      course_id: courseId,
      timetable_event_id: event.id,
      tp_group_id: scopeKind === "tpgroup" ? scopeId : null,
      subgroup_id: scopeKind === "subgroup" ? scopeId : null,
      created_by: trainer.id,
    })
    .select("id")
    .single();
  if (blockError || !block) return { error: "Could not create the booking sheet." };

  const { error: rpcError } = await supabase.rpc("set_stage2_slot_count", {
    p_block_id: block.id,
    p_slot_count: slotCountFromDuration(duration),
  });
  if (rpcError) return { error: "Could not generate booking positions." };

  const siteUrl = process.env.SITE_URL;
  const sheetUrl = siteUrl ? `${siteUrl}/trainer/timetable/stage2/${block.id}` : null;
  await supabase.from("course_broadcasts").insert({
    course_id: courseId,
    author_id: trainer.id,
    title: `Stage 2 tutorials ${eventDate} — book your spot`,
    body: "Open the sheet below to claim a position. Positions are numbered (1st, 2nd, 3rd...), not exact times.",
    attachment_name: sheetUrl ? "Open booking sheet" : null,
    attachment_url: sheetUrl,
    // Immediate, not held pending. keep_on_duplicate stays false here
    // deliberately: duplicateCourse never re-creates stage2_tutorial_blocks/
    // slots (they're per-cohort bookings, same reason plan_assignments/
    // tp_feedback aren't duplicated either) -- keeping this announcement
    // would link to a sheet that no longer exists in the new course.
    anchor_event_id: event.id,
    anchor_offset_days: 0,
    sent_at: new Date().toISOString(),
    keep_on_duplicate: false,
    visible_to_tp_group_id: scopeKind === "tpgroup" ? scopeId : null,
    visible_to_subgroup_id: scopeKind === "subgroup" ? scopeId : null,
  });

  revalidatePath("/trainer/timetable");
  revalidatePath(`/trainer/timetable/stage2/${block.id}`);
  return { error: null };
}

// "If it turns out too short, the tutor can adjust the block length --
// unbooked positions regenerate; anyone already booked keeps their
// position." Duration lives only on the timetable event; slot count is
// re-derived and handed to the same RPC used at creation.
export async function updateStage2Duration(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const blockId = formData.get("block_id");
  const durationRaw = formData.get("duration_minutes");
  if (typeof blockId !== "string" || typeof durationRaw !== "string") return;
  const duration = Number(durationRaw);
  if (Number.isNaN(duration) || duration < 15) return;

  const supabase = await createClient();
  const { data: block } = await supabase
    .from("stage2_tutorial_blocks")
    .select("id, course_id")
    .eq("id", blockId)
    .eq("course_id", trainer.course_id ?? "")
    .maybeSingle();
  if (!block) return;

  await supabase.rpc("set_stage2_slot_count", { p_block_id: block.id, p_slot_count: slotCountFromDuration(duration) });
  revalidatePath(`/trainer/timetable/stage2/${blockId}`);
}

export interface BookState {
  error: string | null;
}

// Claims the lowest-numbered open position. The read (find the lowest
// open row) and write are two steps, but the write itself is conditioned
// on that exact row still being open (id + trainee_id is null), and RLS's
// own USING re-check at UPDATE time closes the gap a plain read-then-write
// would leave -- see migration 0094's policy comment.
export async function bookStage2Slot(_prevState: BookState, formData: FormData): Promise<BookState> {
  const blockId = formData.get("block_id");
  if (typeof blockId !== "string") return { error: "Missing booking sheet." };

  const supabase = await createClient();
  const { data: openSlot } = await supabase
    .from("stage2_tutorial_slots")
    .select("id")
    .eq("block_id", blockId)
    .is("trainee_id", null)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!openSlot) return { error: "No open positions left." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error, count } = await supabase
    .from("stage2_tutorial_slots")
    .update({ trainee_id: user.id, booked_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", openSlot.id)
    .is("trainee_id", null);

  if (error) return { error: "Could not book -- try again." };
  if (count === 0) return { error: "Someone just took that position -- try again." };

  revalidatePath(`/portfolio/[traineeId]/stage2-tutorial/[blockId]`, "layout");
  revalidatePath(`/trainer/timetable/stage2/${blockId}`);
  return { error: null };
}

export async function releaseStage2Slot(formData: FormData): Promise<void> {
  const slotId = formData.get("slot_id");
  const blockId = formData.get("block_id");
  if (typeof slotId !== "string") return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("stage2_tutorial_slots").update({ trainee_id: null, booked_at: null }).eq("id", slotId).eq("trainee_id", user.id);

  if (typeof blockId === "string") {
    revalidatePath(`/portfolio/[traineeId]/stage2-tutorial/[blockId]`, "layout");
    revalidatePath(`/trainer/timetable/stage2/${blockId}`);
  }
}
