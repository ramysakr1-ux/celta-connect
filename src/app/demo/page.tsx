import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

// build-spec.md's "Demo -- a flagged clone of the real app," extended per
// connect-multi-role-demo-spec-2026-08-22.md into five entry points, one
// per role, all viewing the same seeded mid-course state through their own
// lens. Each link is a plain GET to its own /demo/<role> route -- no form,
// nothing to submit, permanently reusable by anyone.
const ENTRIES: { href: string; role: string; blurb: string }[] = [
  {
    href: "/demo/centre-admin",
    role: "Centre management",
    blurb: "The centre owner's view: courses, payments, staffing and volunteers across the whole centre.",
  },
  {
    href: "/demo/course-admin",
    role: "Course admin",
    blurb: "Running one course day to day: invitations, groups, timetable and admissions.",
  },
  {
    href: "/demo/trainer",
    role: "Trainer (MCT)",
    blurb: "The main course tutor's view: TP feedback, grading, CELTA5 and the trainee roster.",
  },
  {
    href: "/demo/trainer-act",
    role: "Trainer (ACT)",
    blurb: "The assistant course tutor's view of the same course -- same data, different layout from the MCT's.",
  },
  {
    href: "/demo/trainee",
    role: "Trainee",
    blurb: "A candidate mid-course: TPs taught and upcoming, assignments, and their own CELTA5 record.",
  },
  {
    href: "/demo/volunteer",
    role: "Volunteer student",
    blurb: "No login -- a token-based view of upcoming classes, shared materials and hours toward a certificate.",
  },
  {
    href: "/demo/assessor",
    role: "Assessor",
    blurb: "No login -- a token-based, read-only view of the visit pack: candidate readiness, CELTA5 records and marking guidance.",
  },
];

export default function DemoLandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container flex flex-col gap-8 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <Link href="/" className="hover:opacity-80">
            <Wordmark size="hero" />
          </Link>
          <h1 className="font-serif text-2xl text-ink">Try Connect as any role</h1>
          <p className="max-w-md text-sm text-muted">
            Every link below drops you straight into a seeded, isolated demo centre with real-looking mid-course
            data. Nothing you do here touches a real centre, and every link is safe to share and revisit.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ENTRIES.map((entry) => (
            <a key={entry.href} href={entry.href} className="card-interactive flex flex-col gap-1.5 p-5">
              <span className="font-serif text-lg text-ink">{entry.role}</span>
              <span className="text-sm text-muted">{entry.blurb}</span>
              <span className="mt-2 text-sm font-semibold text-primary">Enter demo &rarr;</span>
            </a>
          ))}
        </div>

        <a href="/demo/journey" className="card-interactive flex flex-col gap-1.5 p-5 text-center">
          <span className="font-serif text-lg text-ink">The application journey</span>
          <span className="text-sm text-muted">
            Step by step: how a trainee applies, interviews, and gets an offer -- and how a volunteer student signs
            up. Every form and every email, in order.
          </span>
          <span className="mt-2 text-sm font-semibold text-primary">See the journey &rarr;</span>
        </a>
      </div>
    </div>
  );
}
