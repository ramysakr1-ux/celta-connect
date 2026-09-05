"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/require-role";
import { isMctOfCourse } from "@/lib/course-tutor-role";
import { slotCountFromDuration } from "@/lib/stage2-tutorials";

export interface FormState {
  error: string | null;
}

// Consultation blocks (migration 0275) on the Stage 2 engine: a tutor
// places a block, Connect cuts it into 15-minute positions, candidates
// book the next open one. A block belongs to a tutor, not a group. The
// MCT may place one for any tutor on the course; an ACT only for
// themselves (design_handoff_tutorials_consultations, "Roles").
export async function createConsultationBlock(_prevState: FormState, formData: FormData): Promise<FormState> {
  const trainer = await requireRole(["trainer", "admin"]);
  if (!trainer.course_id) return { error: "No course assigned." };

  const tutorIdRaw = (formData.get("tutor_profile_id") as string | null) || trainer.id;
  const tutorName = (formData.get("tutor_name") as string | null)?.trim() || "your tutor";
  const eventDate = formData.get("event_date") as string | null;
  const eventTime = formData.get("event_time") as string | null;
  const durationRaw = formData.get("duration_minutes") as string | null;
  if (!eventDate || !eventTime || !durationRaw) return { error: "Fill in the date, start time and duration." };
  const duration = Number(durationRaw);
  if (Number.isNaN(duration) || duration < 15) return { error: "Duration must be at least 15 minutes." };

  const courseId = trainer.course_id;
  if (tutorIdRaw !== trainer.id && trainer.role === "trainer" && !(await isMctOfCourse(trainer, courseId))) {
    return { error: "Only the main course tutor can place a block for another tutor." };
  }

  const supabase = await createClient();
  // The "consultation" tag is the syllabus's own band (remaining-
  // compliance.md item 2), so the block lands on the timetable as the
  // kind of session it is, and the tile's panel gets a booking door.
  const { data: event, error: eventError } = await supabase
    .from("course_timetable_events")
    .insert({
      course_id: courseId,
      type: "milestone",
      tag: "consultation",
      title: `Consultation — ${tutorName}`,
      detail: "Bookable",
      event_date: eventDate,
      event_time: eventTime,
      created_by: trainer.id,
    })
    .select("id")
    .single();
  if (eventError || !event) return { error: eventError?.message ?? "Could not add the timetable slot." };

  const { data: block, error: blockError } = await supabase
    .from("consultation_blocks")
    .insert({ course_id: courseId, tutor_profile_id: tutorIdRaw, timetable_event_id: event.id, created_by: trainer.id })
    .select("id")
    .single();
  if (blockError || !block) return { error: blockError?.message ?? "Could not create the booking sheet." };

  const { error: rpcError } = await supabase.rpc("set_consultation_slot_count", {
    p_block_id: block.id,
    p_slot_count: slotCountFromDuration(duration),
  });
  if (rpcError) {
    console.error("[trainer/(hub)/timetable/consultation-actions.ts:createConsultationBlock]", rpcError);
    return { error: "Could not generate booking positions." };
  }

  // One announcement when the block is placed, never per booking -- the
  // sheet is the source of truth, same as Stage 2.
  await supabase.from("course_broadcasts").insert({
    course_id: courseId,
    author_id: trainer.id,
    title: `Consultation time with ${tutorName} — ${eventDate}`,
    body: "Book a position from your timetable if you want one. Positions are 15 minutes, in order.",
    anchor_event_id: event.id,
    anchor_offset_days: 0,
    sent_at: new Date().toISOString(),
    keep_on_duplicate: false,
  });

  revalidatePath("/trainer/timetable");
  revalidatePath(`/trainer/timetable/consultation/${block.id}`);
  return { error: null };
}

// Lengthen or shorten a block: open positions regenerate, anyone already
// booked keeps theirs (same rule as Stage 2).
export async function updateConsultationDuration(formData: FormData): Promise<void> {
  const trainer = await requireRole(["trainer", "admin"]);
  const blockId = formData.get("block_id");
  const durationRaw = formData.get("duration_minutes");
  if (typeof blockId !== "string" || typeof durationRaw !== "string") return;
  const duration = Number(durationRaw);
  if (Number.isNaN(duration) || duration < 15) return;

  const supabase = await createClient();
  const { data: block } = await supabase.from("consultation_blocks").select("id, course_id").eq("id", blockId).eq("course_id", trainer.course_id ?? "").maybeSingle();
  if (!block) return;

  await supabase.rpc("set_consultation_slot_count", { p_block_id: block.id, p_slot_count: slotCountFromDuration(duration) });
  revalidatePath(`/trainer/timetable/consultation/${blockId}`);
  revalidatePath("/trainer/timetable");
}

export interface BookState {
  error: string | null;
}

// build-spec.md rule 15: "before an assignment's first submission, a
// candidate can book consultation with any tutor. Once they've submitted,
// consultation on that assignment is restricted to their own tutor only."
// Judged here, at booking, against the assignment the candidate names --
// or, when they name none, against whether they have submitted anything.
export async function bookConsultationSlot(_prevState: BookState, formData: FormData): Promise<BookState> {
  const blockId = formData.get("block_id");
  const assignmentType = ((formData.get("assignment_type") as string | null) || "").trim() || null;
  if (typeof blockId !== "string") return { error: "Missing booking sheet." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: block } = await supabase.from("consultation_blocks").select("id, course_id, tutor_profile_id").eq("id", blockId).maybeSingle();
  if (!block) return { error: "That sheet is not on your course." };

  // The rule reads the candidate's group tutor and their submissions with
  // the service role -- a candidate's own client cannot see every row the
  // rule needs, and the answer is the rule's, not theirs to shape.
  const admin = createAdminClient();
  const [{ data: membership }, { data: submissions }, { data: tutorProfile }] = await Promise.all([
    admin.from("course_subgroup_members").select("subgroup_id, course_subgroups!inner(tp_group_id)").eq("trainee_id", user.id).maybeSingle(),
    admin.from("assignments").select("assignment_type, first_submitted_at").eq("trainee_id", user.id).eq("course_id", block.course_id),
    admin.from("profiles").select("full_name").eq("id", block.tutor_profile_id).maybeSingle(),
  ]);
  const tpGroupId = (membership as { course_subgroups?: { tp_group_id: string | null } | null } | null)?.course_subgroups?.tp_group_id ?? null;
  const { data: group } = tpGroupId ? await admin.from("course_tp_groups").select("tutor_profile_id").eq("id", tpGroupId).maybeSingle() : { data: null };
  const ownTutorId = group?.tutor_profile_id ?? null;
  const isOwnTutor = ownTutorId === block.tutor_profile_id;

  if (!isOwnTutor) {
    const submitted = (submissions ?? []).filter((a) => a.first_submitted_at);
    const blocked = assignmentType ? submitted.some((a) => a.assignment_type === assignmentType) : submitted.length > 0;
    if (blocked) {
      return {
        error: assignmentType
          ? `You have already submitted ${assignmentType}, so consultation on it is with your own tutor only -- not ${tutorProfile?.full_name ?? "this tutor"}.`
          : "You have submitted an assignment, so consultation is with your own tutor only -- pick their sheet, or say which assignment this is about.",
      };
    }
  }

  const { data: openSlot } = await supabase
    .from("consultation_slots")
    .select("id")
    .eq("block_id", blockId)
    .is("trainee_id", null)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!openSlot) return { error: "No open positions left." };

  const { error, count } = await supabase
    .from("consultation_slots")
    .update({ trainee_id: user.id, booked_at: new Date().toISOString(), assignment_type: assignmentType }, { count: "exact" })
    .eq("id", openSlot.id)
    .is("trainee_id", null);
  if (error) {
    console.error("[trainer/(hub)/timetable/consultation-actions.ts:bookConsultationSlot]", error);
    return { error: "Could not book -- try again." };
  }
  if (count === 0) return { error: "Someone just took that position -- try again." };

  revalidatePath(`/portfolio/[traineeId]/consultation/[blockId]`, "layout");
  revalidatePath(`/trainer/timetable/consultation/${blockId}`);
  revalidatePath("/trainer/timetable");
  return { error: null };
}

export async function releaseConsultationSlot(formData: FormData): Promise<void> {
  const slotId = formData.get("slot_id");
  const blockId = formData.get("block_id");
  if (typeof slotId !== "string") return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("consultation_slots").update({ trainee_id: null, booked_at: null, assignment_type: null }).eq("id", slotId).eq("trainee_id", user.id);

  if (typeof blockId === "string") {
    revalidatePath(`/portfolio/[traineeId]/consultation/[blockId]`, "layout");
    revalidatePath(`/trainer/timetable/consultation/${blockId}`);
    revalidatePath("/trainer/timetable");
  }
}
