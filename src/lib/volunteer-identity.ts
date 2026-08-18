import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// The only safe auto-match: an exact email, which most signups don't even
// collect. No email -> stays unlinked until an admin manually links it from
// the Centre Admin Volunteer pool -- see linkVolunteerPeople below. Never
// matches on name alone (see migration 0125's comment for why).
export async function linkVolunteerByEmail(
  supabase: SupabaseClient<Database>,
  params: { volunteerStudentId: string; centerId: string; email: string | null }
): Promise<void> {
  const email = params.email?.trim().toLowerCase();
  if (!email) return;

  const { data: existing } = await supabase
    .from("volunteer_people")
    .select("id")
    .eq("center_id", params.centerId)
    .eq("email", email)
    .maybeSingle();

  const personId =
    existing?.id ??
    (await supabase.from("volunteer_people").insert({ center_id: params.centerId, email }).select("id").single()).data?.id;
  if (!personId) return;

  await supabase.from("volunteer_students").update({ volunteer_person_id: personId }).eq("id", params.volunteerStudentId);
}

// Manual link for the common case (no email): folds two volunteer_students
// rows -- possibly from different courses -- into one identity. If either
// side is already linked to a volunteer_people row, the other joins it
// rather than creating a second one.
export async function linkVolunteerPeople(
  supabase: SupabaseClient<Database>,
  params: { centerId: string; volunteerStudentIdA: string; volunteerStudentIdB: string }
): Promise<{ error: string | null }> {
  const { data: rows, error: fetchError } = await supabase
    .from("volunteer_students")
    .select("id, volunteer_person_id")
    .in("id", [params.volunteerStudentIdA, params.volunteerStudentIdB]);
  if (fetchError || !rows || rows.length !== 2) return { error: "Could not find both volunteers." };

  let personId = rows.find((r) => r.volunteer_person_id)?.volunteer_person_id ?? null;
  if (!personId) {
    const { data: created, error: createError } = await supabase
      .from("volunteer_people")
      .insert({ center_id: params.centerId })
      .select("id")
      .single();
    if (createError || !created) return { error: "Could not link them. Try again." };
    personId = created.id;
  }

  const { error: updateError } = await supabase
    .from("volunteer_students")
    .update({ volunteer_person_id: personId })
    .in("id", [params.volunteerStudentIdA, params.volunteerStudentIdB]);
  if (updateError) return { error: "Could not link them. Try again." };

  return { error: null };
}

// Detaches one course registration from its linked identity. If that leaves
// exactly one member behind, the group is dissolved entirely (that member
// goes back to being unlinked too) rather than leaving a group of one --
// there's nothing left to total across.
export async function unlinkVolunteer(
  supabase: SupabaseClient<Database>,
  volunteerStudentId: string
): Promise<{ error: string | null }> {
  const { data: row } = await supabase
    .from("volunteer_students")
    .select("volunteer_person_id")
    .eq("id", volunteerStudentId)
    .maybeSingle();
  const personId = row?.volunteer_person_id;
  if (!personId) return { error: null };

  const { error: detachError } = await supabase
    .from("volunteer_students")
    .update({ volunteer_person_id: null })
    .eq("id", volunteerStudentId);
  if (detachError) return { error: "Could not unlink. Try again." };

  const { data: remaining } = await supabase.from("volunteer_students").select("id").eq("volunteer_person_id", personId);
  if ((remaining ?? []).length === 1) {
    await supabase.from("volunteer_students").update({ volunteer_person_id: null }).eq("volunteer_person_id", personId);
    await supabase.from("volunteer_people").delete().eq("id", personId);
  }

  return { error: null };
}
