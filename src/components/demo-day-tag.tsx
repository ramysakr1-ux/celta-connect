import { demoClockTag } from "@/lib/demo-clock";

// "Demo · Day 7" — the demo clock, named on screen.
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
}: {
  /** A token viewer's course (assessor, volunteer); omit when signed in. */
  courseId?: string;
  tone?: "dark" | "light";
}) {
  const tag = await demoClockTag(courseId);
  if (!tag) return null;
  return (
    <span
      className="flex-none rounded-full border px-2 py-0.5 text-micro font-bold tracking-[0.12em] uppercase tabular-nums"
      style={
        tone === "dark"
          ? { borderColor: "oklch(78% 0.02 80 / 0.35)", color: "oklch(78% 0.02 80)" }
          : { borderColor: "var(--color-border)", color: "var(--color-muted)" }
      }
    >
      {tag}
    </span>
  );
}
