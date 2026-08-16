import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";

// specs/for-claude-code-getting-started-doc.md. A single standalone page, not
// an in-app walkthrough: "the recipient has no account yet when they see it, so
// it must stand alone with no app around it." Linked from the two staff
// invitation emails (tutor_added, centre_created).
//
// Copy is taken verbatim from `specs/handoffs/Getting Started Letter.dc.html`,
// which is the built letter rather than a draft -- the spec is explicit that
// several steps were rewritten during review and the letter, not the older
// `Admin Task Guides.dc.html`, is the current text. Two corrections in
// particular are load-bearing and must not be "fixed" back:
//
//   - Closing a course says SEVEN days then permanent erasure. The older guides
//     file still says "reversible for 30 days", which contradicts build-spec's
//     close-out rule. The seven-day version is correct.
//   - Assessor prep is "once the visit date is confirmed", not a fixed 2-3
//     weeks, because the notice a centre gets varies.

export const metadata: Metadata = {
  title: "Getting started with Connect",
  description: "The seven things that come up most while running a course.",
};

// "One flowing page, not the in-app card-plus-progress-bar UI... No
// interactivity -- no click-to-open cards, no progress bar, no 'Done' buttons.
// This is a read, not a tool." So this is a server component with no client
// bundle at all.

const TEAL = "oklch(38% 0.072 195)";
const GOLD = "oklch(60% 0.11 70)";
const GREEN = "oklch(48% 0.09 150)";

interface Step {
  title: string;
  text: string;
}
interface Guide {
  title: string;
  when: string;
  tone: string;
  steps: Step[];
}

const GUIDES: Guide[] = [
  {
    title: "Setting up a new course",
    when: "Once per intake, often months ahead",
    tone: TEAL,
    steps: [
      {
        title: "Dates and course code",
        text: "the Cambridge course number and your own reference — both fixed once anyone is enrolled.",
      },
      {
        title: "Delivery mode",
        text: "face to face, online, or mixed. Changing this later rebuilds the timetable from scratch.",
      },
      { title: "Applications and fees", text: "fee, deposit, and how long an offer stays open." },
      {
        title: "Tutors",
        text: "assign a lead trainer and any others, including a trainer in training.",
      },
      { title: "Levels and groups", text: "two levels, two groups — everything downstream reads this." },
      { title: "Timetable", text: "duplicate a reference course rather than building from scratch." },
    ],
  },
  {
    title: "Taking an application through to enrolment",
    when: "Continuously, from the day applications open",
    tone: GOLD,
    steps: [
      {
        title: "Application arrives",
        text: "logged automatically the moment they submit — name, email, source, and the pre-interview task waiting for them in Connect.",
      },
      {
        title: "The task gets read automatically",
        text: "Connect reads it and sorts into three lanes: clearly strong books an interview itself after a 15-minute hold you can still cancel; borderline queues for you to decide; a flagged problem notifies a tutor directly. It never rejects anyone on its own — that's always a person's words.",
      },
      {
        title: "Interview happens",
        text: "against the availability you set up once — the booking and its record are the same entry, so nothing depends on an email arriving.",
      },
      {
        title: "You make the offer",
        text: "fee, deposit and an expiry date — the only step that's genuinely yours to write.",
      },
      {
        title: "Deposit clears",
        text: "the workspace invitation fires itself the instant a connected provider confirms payment. Paying another way? You mark it received and Connect sends the invitation for you.",
      },
      {
        title: "Enrolled",
        text: "nothing left to send by hand — you've been driving the offer, Connect has been driving the paperwork around it.",
      },
    ],
  },
  {
    title: "Inviting people to Connect",
    when: "Each time someone new joins a course or the centre",
    tone: TEAL,
    steps: [
      {
        title: "Choose a role",
        text: "this is the one step that stays a deliberate, human decision — a role is invited, never self-selected, and nothing in Connect promotes an account on its own.",
      },
      {
        title: "Enter the email",
        text: "the invitation is bound to that address — forwarding it doesn't work, by design.",
      },
      {
        title: "Send",
        text: "one email, one code, one account — Connect handles the rest of the setup once they click through.",
      },
    ],
  },
  {
    title: "Importing existing records",
    when: "Once, when a centre first moves to Connect",
    tone: GOLD,
    steps: [
      {
        title: "Connect the sheet",
        text: "Drive pick or drag in a spreadsheet, any column order — read-only, and revocable the moment the import finishes.",
      },
      {
        title: "Connect maps the columns itself",
        text: "name, email, phone and deposit usually match automatically. Only your centre's own vocabulary — a custom status column, say — needs a decision from you.",
      },
      {
        title: "See the whole thing before anything is written",
        text: "a full dry run: what will import, what's duplicated, what's missing an email, all flagged before you commit to anything.",
      },
      {
        title: "Import",
        text: "records only — nobody is emailed automatically. Run it again later and Connect matches on email so nobody doubles up.",
      },
    ],
  },
  {
    title: "Publishing and changing a timetable",
    when: "Once before the course, then whenever something moves",
    tone: TEAL,
    steps: [
      {
        title: "Duplicate a reference course",
        text: "four-week, five-week Fridays-off, or part-time.",
      },
      { title: "Check the warnings", text: "each one is a rule stated at the moment it is broken." },
      { title: "Publish", text: "candidates see their own dates only." },
      {
        title: "Change something afterwards",
        text: "moving a deadline moves its marking slot and resubmission window with it.",
      },
    ],
  },
  {
    title: "Preparing for the assessor visit",
    when: "Once the visit date is confirmed — how much notice you get varies",
    tone: GOLD,
    steps: [
      {
        title: "Confirm the date and session",
        text: "candidates teaching that session are told weeks ahead.",
      },
      {
        title: "Check the pack",
        text: "timetable, tutor records, portfolios, assignment records, TinT arrangement.",
      },
      {
        title: "Fill the gaps",
        text: "anything missing is listed with a link to where it is created.",
      },
      {
        title: "Send",
        text: "a point-in-time export — later changes don't alter a pack already sent.",
      },
    ],
  },
  {
    title: "Closing a course",
    when: "The final week, and the week after",
    tone: GREEN,
    steps: [
      { title: "Check all submissions are in", text: "including resubmissions." },
      { title: "Complete the portfolios", text: "assembled as the course ran, not at the end." },
      { title: "Grades and CELTA 5s", text: "both need typed-name signatures." },
      {
        title: "Send the results",
        text: "candidates are told in a tutorial first, never by email first.",
      },
      {
        title: "Archive",
        text: "everything exports to your Drive, then Connect keeps it seven more days — check the export in that window, because after it, the course is erased permanently. No copy stays with us. That's a promise: your candidates' records exist only where you put them.",
      },
    ],
  },
];

export default function GettingStartedPage() {
  return (
    <main className="mx-auto max-w-[46rem] px-6 py-14 print:py-0">
      <header className="flex justify-center">
        {/* "static -- no spin on a document", at the sign-in/certificate size. */}
        <Wordmark size="hero" spin={false} />
      </header>

      <h1
        className="mt-12 text-[2rem] leading-tight"
        style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--color-ink)" }}
      >
        Welcome to Connect — a short letter before you start
      </h1>

      <div className="mt-7 space-y-4 text-[1.0625rem] leading-relaxed" style={{ color: "var(--color-ink)" }}>
        <p>Hi, and welcome —</p>
        <p>
          You&apos;ve just been invited to Connect as a <strong>Centre administrator</strong>. Before you log in, I
          wanted to send you the seven things that come up most while running a course — set up, admissions,
          invitations, imports, timetabling, the assessor visit, and closing a course out.
        </p>
        <p>
          None of this is required reading. It&apos;s here so the first time you hit one of these tasks, you&apos;re not
          guessing.
        </p>
      </div>

      <section className="mt-14">
        <h2
          className="text-[1.5rem]"
          style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--color-ink)" }}
        >
          The seven guides
        </h2>
        <p className="mt-3 text-[0.9375rem] leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Each one below is also available inside Connect, right on the screen it&apos;s about. No screenshots here —
          they go stale fast and end up teaching the wrong thing.
        </p>
      </section>

      <div className="mt-10 space-y-11">
        {GUIDES.map((guide) => (
          <section
            key={guide.title}
            className="break-inside-avoid rounded-xl border p-6"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-card)",
              borderLeftWidth: 3,
              borderLeftColor: guide.tone,
            }}
          >
            <h3
              className="text-[1.25rem] leading-snug"
              style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--color-ink)" }}
            >
              {guide.title}
            </h3>
            <p
              className="mt-1.5 text-[0.8125rem] font-semibold uppercase tracking-[0.08em]"
              style={{ color: guide.tone }}
            >
              {guide.when}
            </p>

            <ol className="mt-5 space-y-4">
              {guide.steps.map((step, i) => (
                <li key={step.title} className="flex gap-3.5">
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold"
                    style={{ background: guide.tone, color: "var(--color-card)" }}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <p className="text-[0.9375rem] leading-relaxed" style={{ color: "var(--color-ink)" }}>
                    <strong>{step.title}</strong>{" "}
                    <span style={{ color: "var(--color-muted)" }}>— {step.text}</span>
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {/*
        "signed personally... this is the one document where Connect and Ramy
        appear directly by name, since it's platform documentation rather than
        an email (the 'every email is from the centre' rule governs emails, not
        this linked doc)."
      */}
      <footer className="mt-16 border-t pt-8" style={{ borderColor: "var(--color-border)" }}>
        <p className="text-[1.0625rem]" style={{ color: "var(--color-muted)" }}>
          Warmly,
        </p>
        <p className="mt-2 text-[1.25rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--color-ink)" }}>
          Ramy Sakr
        </p>
        <p className="mt-0.5 text-[0.875rem]" style={{ color: "var(--color-muted)" }}>
          Founder, Connect
        </p>

        <p className="mt-7 text-[0.9375rem] leading-relaxed" style={{ color: "var(--color-muted)" }}>
          Need anything at all? Write to{" "}
          <a href="mailto:support@celtaconnect.com" style={{ color: "var(--color-primary)" }}>
            support@celtaconnect.com
          </a>{" "}
          and we&apos;ll help directly.
        </p>

        <p className="mt-4 text-[0.9375rem]" style={{ color: "var(--color-muted)" }}>
          When you&apos;re ready:{" "}
          <a href="/login" style={{ color: "var(--color-primary)" }}>
            sign in to Connect
          </a>
        </p>

        <p className="mt-8 text-[0.8125rem] leading-relaxed" style={{ color: "var(--color-muted)" }}>
          This letter is addressed to a Centre administrator. Course administrators and Centre owners receive the same
          seven guides with the wording adjusted to their role&apos;s scope.
        </p>
      </footer>
    </main>
  );
}
