import { redirect } from "next/navigation";

// Trainee workspace A2, 16 Sep 2026. Progress and CELTA 5 showed the same
// thing -- Ramy, 29 Aug 2026: "CELTA 5 at the bottom where you're working on
// it, and then something says Progress, and it's exactly the same. We don't
// need both." This page's own comment had already conceded it ("some query
// logic is duplicated with celta5/page.tsx's trainee branch -- an accepted
// tradeoff"): the same self-assessment block, the same observation tasks,
// the same observations of experienced teachers.
//
// CELTA 5 is the superset -- criteria matrix, the three stages, signatures,
// attendance, absences -- so it is the one that stays. The route survives as
// a redirect because links to it exist in the wild; it stopped being a tab
// in the rail on 29 Aug and left the phone bar and the staff tabs with A1.
export default async function ProgressPage({ params }: { params: Promise<{ traineeId: string }> }) {
  const { traineeId } = await params;
  redirect(`/portfolio/${traineeId}/celta5`);
}
