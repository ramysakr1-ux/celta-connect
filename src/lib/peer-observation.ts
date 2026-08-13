import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// specs/build-spec.md "Peer observation -- the shared sheet". Pure helpers,
// no I/O, so the trainer-side (sheet creation) and trainee-side (note
// eligibility) call sites can't disagree on what they mean.

export interface InputSessionForCriteria {
  event_date: string;
  input_session_criteria: string[];
}

// "The task is generated from the criterion the cohort is working on,
// which comes from that week's input session... week one asks about
// instructions (4c), week four about staging and pace." Read as: the
// MOST RECENT input session on or before the TP date that actually has
// criteria set -- not a cumulative union across the course, since the
// spec's own examples are each tied to a single week's session.
export function criteriaForTpDate(sessions: InputSessionForCriteria[], tpDate: string): string[] {
  const candidates = sessions
    .filter((s) => s.event_date <= tpDate && s.input_session_criteria.length > 0)
    .sort((a, b) => (a.event_date < b.event_date ? 1 : -1));
  return candidates[0]?.input_session_criteria ?? [];
}

export interface TpGroupMember {
  traineeId: string;
  subgroupId: string;
}

// The "group of six" a peer-observation lesson draws its five observers
// from -- both paired subgroup halves of one course_tp_groups pairing.
// members here is already the full flat list of both halves' members
// (buildMembers() for each half, concatenated) -- this just excludes the
// trainee being observed.
export function otherGroupMembers(members: TpGroupMember[], observedTraineeId: string): TpGroupMember[] {
  return members.filter((m) => m.traineeId !== observedTraineeId);
}

// The real "group of six" -- both halves of a paired course_tp_groups
// pairing. Falls back to just the trainee's own subgroup when it isn't
// paired (a smaller/simpler course setup, or pairing not done yet) rather
// than blocking peer observation entirely.
export async function getPeerGroupMembers(
  supabase: SupabaseClient<Database>,
  traineeId: string
): Promise<TpGroupMember[]> {
  const { data: membership } = await supabase
    .from("course_subgroup_members")
    .select("subgroup_id")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (!membership) return [];

  const { data: subgroup } = await supabase
    .from("course_subgroups")
    .select("id, tp_group_id")
    .eq("id", membership.subgroup_id)
    .maybeSingle();
  if (!subgroup) return [];

  let subgroupIds = [subgroup.id];
  if (subgroup.tp_group_id) {
    const { data: pairedSubgroups } = await supabase
      .from("course_subgroups")
      .select("id")
      .eq("tp_group_id", subgroup.tp_group_id);
    if (pairedSubgroups && pairedSubgroups.length > 0) {
      subgroupIds = pairedSubgroups.map((s) => s.id);
    }
  }

  const { data: members } = await supabase
    .from("course_subgroup_members")
    .select("trainee_id, subgroup_id")
    .in("subgroup_id", subgroupIds);

  return (members ?? []).map((m) => ({ traineeId: m.trainee_id, subgroupId: m.subgroup_id }));
}
