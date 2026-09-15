import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// specs/build-spec.md §2: "do not allow [close-out] while: a deferred
// candidate has no destination course chosen (or an explicit 'hold at
// centre' flag); an extension is outstanding; Cambridge has not confirmed
// final grades. Hold the erasure, not the export." -- read here for the
// admin UI, and re-checked server-side in initiateCloseOut before any
// state changes, since a UI check alone is never enough authorization.
//
// Read through the ADMIN client, not the caller's session.
//
// It used to use the session client, and grade_query_replies' policy is
// `course_id = current_course_id()` -- the reader's own active course. A
// centre admin running close-out has no active course, and an MCT closing
// a course they are not currently switched into does not match either, so
// the open-appeals query came back empty and the "a grade appeal is still
// open" reason silently disappeared. The candidate whose grade was under
// appeal would have had their account and all their coursework
// permanently deleted seven days later, which is the exact thing this rule
// exists to prevent (walked 15 Sep 2026).
//
// A safety check has to read what is true, not what the person asking
// happens to be able to see. Every caller is already authorised to be on
// the screen.
export interface CloseOutBlockingReason {
  code: "deferred_without_destination" | "extension_outstanding" | "cambridge_not_confirmed" | "grade_appeal_open";
  message: string;
}

export async function getCloseOutBlockingReasons(courseId: string): Promise<CloseOutBlockingReason[]> {
  const supabase = createAdminClient();
  const reasons: CloseOutBlockingReason[] = [];

  const [{ data: course }, { data: unlinkedDeferrals }, { data: extensionTrainees }, { data: openAppeals }] = await Promise.all([
    supabase.from("courses").select("cambridge_grades_confirmed_at").eq("id", courseId).maybeSingle(),
    supabase
      .from("deferral_transfers")
      .select("id")
      .eq("source_course_id", courseId)
      .is("destination_course_id", null)
      .eq("hold_at_centre", false),
    supabase.from("profiles").select("id").eq("course_id", courseId).eq("course_status", "extension"),
    // connect-build-specs-5-gaps-2026-08-21.md item 5: close-out blocks
    // while a filed reply has a raised-but-not-yet-resolved appeal flag.
    supabase
      .from("grade_query_replies")
      .select("id")
      .eq("course_id", courseId)
      .not("appeal_raised_at", "is", null)
      .is("appeal_resolved_at", null),
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

  if (openAppeals && openAppeals.length > 0) {
    reasons.push({
      code: "grade_appeal_open",
      message: `${openAppeals.length} grade appeal${openAppeals.length === 1 ? " is" : "s are"} still open.`,
    });
  }

  return reasons;
}
