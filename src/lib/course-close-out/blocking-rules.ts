import "server-only";
import { createClient } from "@/lib/supabase/server";

// specs/build-spec.md §2: "do not allow [close-out] while: a deferred
// candidate has no destination course chosen (or an explicit 'hold at
// centre' flag); an extension is outstanding; Cambridge has not confirmed
// final grades. Hold the erasure, not the export." -- read here for the
// admin UI, and re-checked server-side in initiateCloseOut before any
// state changes, since a UI check alone is never enough authorization.
export interface CloseOutBlockingReason {
  code: "deferred_without_destination" | "extension_outstanding" | "cambridge_not_confirmed";
  message: string;
}

export async function getCloseOutBlockingReasons(courseId: string): Promise<CloseOutBlockingReason[]> {
  const supabase = await createClient();
  const reasons: CloseOutBlockingReason[] = [];

  const [{ data: course }, { data: unlinkedDeferrals }, { data: extensionTrainees }] = await Promise.all([
    supabase.from("courses").select("cambridge_grades_confirmed_at").eq("id", courseId).maybeSingle(),
    supabase
      .from("deferral_transfers")
      .select("id")
      .eq("source_course_id", courseId)
      .is("destination_course_id", null)
      .eq("hold_at_centre", false),
    supabase.from("profiles").select("id").eq("course_id", courseId).eq("course_status", "extension"),
  ]);

  if (!course?.cambridge_grades_confirmed_at) {
    reasons.push({
      code: "cambridge_not_confirmed",
      message: "Cambridge has not confirmed final grades for this course yet.",
    });
  }

  if (unlinkedDeferrals && unlinkedDeferrals.length > 0) {
    reasons.push({
      code: "deferred_without_destination",
      message: `${unlinkedDeferrals.length} deferred candidate${unlinkedDeferrals.length === 1 ? "" : "s"} ${
        unlinkedDeferrals.length === 1 ? "has" : "have"
      } no destination course chosen (or a "hold at centre" flag).`,
    });
  }

  if (extensionTrainees && extensionTrainees.length > 0) {
    reasons.push({
      code: "extension_outstanding",
      message: `${extensionTrainees.length} candidate${extensionTrainees.length === 1 ? "" : "s"} still ${
        extensionTrainees.length === 1 ? "has" : "have"
      } an extension outstanding.`,
    });
  }

  return reasons;
}
