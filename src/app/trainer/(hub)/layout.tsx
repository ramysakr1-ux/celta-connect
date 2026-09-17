import type { Metadata } from "next";
import { TrainerHubChrome } from "@/components/trainer-hub-chrome";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { isMctOfCourse } from "@/lib/course-tutor-role";

// The tutor's own shortcut: garnet with an M for an MCT, gold with an A for
// an ACT (design_handoff_role_shortcuts). Which one is a question about
// this course, so it is asked here rather than assumed from the job title.
export async function generateMetadata(): Promise<Metadata> {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  const mct = profile?.course_id ? await isMctOfCourse(profile, profile.course_id) : false;
  return { manifest: `/shortcuts/${mct ? "trainer-mct" : "trainer-act"}/manifest.webmanifest` };
}


// The operational "Command Centre" -- roster/timetable/volunteers/TP
// rotation/TP points library/grades report. Deliberately separate from
// the /trainer landing (candidate cards + a link into here).
//
// The frame itself lives in components/trainer-hub-chrome.tsx, because the
// candidate's pages have to mount the same one (MCT polish pass §10) and a
// layout cannot be shared across route groups.
export default async function TrainerHubLayout({ children }: { children: React.ReactNode }) {
  return <TrainerHubChrome>{children}</TrainerHubChrome>;
}
