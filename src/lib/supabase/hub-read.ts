import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Reads for a tutor's own course go through the service role.
//
// Ramy, 5 Sep 2026: "do whatever it takes to go fast." Measured the same
// day: the 18 queries behind the roster take ~130 ms in parallel as the
// service role and ~340 ms as the signed-in tutor even after migration
// 0272 made the row policies once-per-query -- the rest is PostgREST's
// per-request auth and policy work, multiplied by every query on the page.
//
// The trade is deliberate and narrow. This client is only handed out after
// the page has already established, from the session, that the caller is a
// tutor whose own course is the one being read (profile.course_id is set
// by the course_tutors link, never by the client). Row security still
// guards every write (server actions keep the user client) and every read
// that goes through the user client elsewhere. scripts/check-course-scope
// .mjs fails the build if a hub page's query forgets to narrow to the
// course, so "the page decided the scope" is checked, not assumed.
export function hubReadClient(trainer: { course_id: string | null } | null, courseId: string) {
  if (!trainer || trainer.course_id !== courseId) {
    throw new Error("hubReadClient: the caller is not on this course");
  }
  return createAdminClient();
}
