import Link from "next/link";
import { Eye, Heart, ShieldCheck } from "lucide-react";

const SEGMENTS = [
  // Points at the hub (roster), not the bare "/trainer" landing -- that
  // used to be the same page as the Command Centre before the landing/hub
  // split (candidate cards vs. roster+tabs), and this link was never
  // updated when that split happened, so it silently sent people back to
  // the landing instead of the operational hub.
  { key: "trainer", role: "Trainer", place: "Command Centre", icon: ShieldCheck, href: "/trainer/roster" },
  { key: "trainee", role: "Trainee", place: "Trainee view", icon: Eye },
  // Interim target: the real §14 "all volunteer-student cards" landing isn't
  // built yet, so this points at the trainer's existing volunteers page
  // rather than a dead link.
  { key: "student", role: "Student", place: "Volunteer students", icon: Heart, href: "/trainer/volunteers" },
] as const;

type SegmentKey = (typeof SEGMENTS)[number]["key"];

// §1.1d -- the app-chrome view switcher (Trainer/Trainee/Student), top-right
// on every trainer/assessor surface, never rendered for a real trainee or
// volunteer student. The active segment shows the PLACE name ("Command
// Centre") rather than the role name, so this single control also replaces
// the old standalone "Command Centre"/"Trainee Workspace" eyebrow label.
export function ViewSwitcherPill({
  current,
  traineeHref,
}: {
  current: SegmentKey;
  traineeHref?: string;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-[5px] border border-border bg-surface-muted p-0.5">
      {SEGMENTS.map((seg) => {
        const Icon = seg.icon;
        const isActive = seg.key === current;
        const href = seg.key === "trainee" ? traineeHref : seg.href;
        const disabled = !href;
        const className = `flex h-7 items-center gap-1.5 rounded-[4px] px-2.5 text-xs font-semibold transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : disabled
              ? "cursor-not-allowed text-muted/50"
              : "text-muted hover:text-ink"
        }`;

        if (disabled) {
          return (
            <span
              key={seg.key}
              className={className}
              aria-disabled="true"
              // Only ever disabled for "trainee" -- there's no neutral,
              // course-wide trainee view to switch into (unlike Student,
              // which always has the volunteers register to land on).
              // Without an explanation this just looked broken/unclickable
              // for no reason -- confirmed live, "I can never click on
              // Trainee." Open a specific candidate first to preview them.
              title="Open a candidate first to preview their view"
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {isActive ? seg.place : seg.role}
            </span>
          );
        }

        return (
          <Link key={seg.key} href={href} className={className}>
            <Icon className="size-3.5" aria-hidden="true" />
            {isActive ? seg.place : seg.role}
          </Link>
        );
      })}
    </div>
  );
}
