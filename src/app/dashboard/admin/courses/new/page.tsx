import { redirect } from "next/navigation";

// The course wizard moved to /centre/courses/new on 2 Sep 2026 -- creating a
// course is Centre Management's act, not Course Admin's. Kept as a redirect
// so any bookmark or half-remembered URL still lands in the right place.
export default function MovedCourseWizard() {
  redirect("/centre/courses/new");
}
