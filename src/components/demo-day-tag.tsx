import Link from "next/link";
import { courseIsDemo, demoClockTag, viewerIsOnDemoCentre } from "@/lib/demo-clock";

// "Demo · Day 7" — the demo clock, named on screen, and the way back to
// the Course Story from wherever a card dropped you.
//
// A ?day=N demo link moves what the whole app calls today
// (for-claude-code-demo-clock.md §1), so every shell that carries a course-day
// counter has to say out loud that the day it is counting is a pretend one.
// Without it "Day 7 of 20" beside a real wall clock reads as live data.
//
// Renders nothing at all on the real clock, and nothing for a viewer whose own
// centre is not the demo one — so it can sit in a shared shell unguarded.
export async function DemoDayTag({
  courseId,
  tone = "light",
  force = false,
}: {
  /** A token viewer's course (assessor, volunteer); omit when signed in. */
  courseId?: string;
  tone?: "dark" | "light";
  /** A page that is demo by construction (/demo/journey/*): no viewer, no
   *  course, still a way back to the story. */
  force?: boolean;
}) {
  // Shown for anyone inside the demo, not only when a ?day= is pinned: it is
  // the way back as well as the label, and a demo viewer on the real clock
  // needs the door just as much.
  const tag = (await demoClockTag(courseId)) ?? ((force || (courseId ? await courseIsDemo(courseId) : await viewerIsOnDemoCentre())) ? "Demo" : null);
  if (!tag) return null;
  // Ramy, 18 Sep 2026, after a Course Story card had taken him into Course
  // Admin: "I want to get back to the day by day demo page... and I can't, so
  // I have to close the page and start again." Every demo shell already
  // carries this pill, so it is the door: same words, now clickable.
  return (
    <Link
      href="/demo/story"
      title="Back to the course story"
      className="wash flex-none rounded-full border px-2 py-0.5 text-micro font-bold tracking-[0.12em] uppercase tabular-nums"
      style={
        tone === "dark"
          ? { borderColor: "oklch(78% 0.02 80 / 0.35)", color: "oklch(78% 0.02 80)" }
          : { borderColor: "var(--color-border)", color: "var(--color-muted)" }
      }
    >
      {tag}
    </Link>
  );
}
