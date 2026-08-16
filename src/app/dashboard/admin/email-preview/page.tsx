import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import {
  interviewInvitationEmailHtml,
  offerEmailHtml,
  rejectionEmailHtml,
  rejectionAfterInterviewEmailHtml,
  waitingListEmailHtml,
  notThisTimeEmailHtml,
  placeFreedEmailHtml,
  welcomeEmailHtml,
} from "@/lib/admissions-email";

// Every email, rendered exactly as it sends.
//
// Built because the alternative is describing them in prose and hoping -- and
// an email is the one surface nobody sees until it has already reached a
// candidate. The sample values here are the design files' own (Leyla, Yasemin,
// C3/2024), so a rendered preview can be held next to the .dc.html file and
// compared line for line.
//
// Staff only. These carry no real candidate data -- every value below is a
// literal -- but the screen is a window onto what the centre says in its own
// name, and that is not public.

export const dynamic = "force-dynamic";

const SAMPLES: { key: string; label: string; source: string; html: string }[] = [
  {
    key: "interview_invitation",
    label: "Interview invitation",
    source: "Applications.dc.html",
    html: interviewInvitationEmailHtml({
      applicantName: "Leyla",
      bookingUrl: "https://celtaconnect.com/interview/sample",
      slotsNote:
        "Times are held for 48 hours. Monday interviews are in person at the centre; Thursday interviews are online.",
    }),
  },
  {
    key: "offer",
    label: "Offer",
    source: "Applications.dc.html",
    html: offerEmailHtml({
      applicantName: "Leyla",
      courseName: "CELTA course C3/2024",
      courseDates: "8 January to 2 February, full time",
      interviewDate: "11 December",
      taskFeedback:
        "Your extended writing task was strong on organisation and substance — you described what your teacher actually did rather than how it felt, which is exactly the habit this course builds on. We will work on phonology with you; both analysis items were left blank and that is worth attention early.",
      feeLine: "The course fee is 32,000 TL.",
      officeContact: "+90 212 000 0000",
      offerUrl: "https://celtaconnect.com/offer/sample",
      acceptWithinDays: 14,
      holdUntil: "22 December",
    }),
  },
  {
    key: "rejection",
    label: "Not suitable — after the task",
    source: "Applications.dc.html",
    html: rejectionEmailHtml({
      applicantName: "Selin",
      centreName: "Meridian English Centre",
      reason:
        "We are not taking your application to interview. The language awareness section showed gaps that would make the first two weeks of the course very difficult — the analysis items described the language rather than analysing it, and meaning and form were not separated.",
      callerName: "Ramy Sakr",
    }),
  },
  {
    key: "rejection_after_interview",
    label: "Not suitable — after the interview",
    source: "Applications.dc.html",
    html: rejectionAfterInterviewEmailHtml({
      applicantName: "Tolga",
      interviewDate: "13 December",
      reason:
        "We are not offering you a place. Your written task was accurate and well organised, but when we worked through the target language together it was clear that analysing language — separating meaning, form and pronunciation — is not yet somewhere you can start from, and the first fortnight would be very hard.",
      callerName: "Ramy Sakr",
    }),
  },
  {
    key: "waiting_list",
    label: "Waiting list",
    source: "Applications.dc.html",
    html: waitingListEmailHtml({
      applicantName: "Yasemin",
      courseName: "CELTA C3/2024",
      positionWord: "second",
      hearBy: "2 January",
      daysBeforeStart: "six days",
      nextCourseName: "March",
    }),
  },
  {
    key: "not_this_time",
    label: "The course filled",
    source: "Applications.dc.html",
    html: notThisTimeEmailHtml({
      applicantName: "Yasemin",
      courseName: "C3/2024",
      positionWord: "second",
      nextCourseName: "March",
      nextCourseStart: "4 March",
      callerName: "Ramy Sakr",
    }),
  },
  {
    key: "place_freed",
    label: "A place has opened",
    source: "Applications.dc.html",
    html: placeFreedEmailHtml({
      applicantName: "Yasemin",
      courseName: "C3/2024",
      courseDates: "8 January to 2 February, full time",
      startsInPhrase: "in eleven days",
      feeLine: "The fee is 32,000 TL;",
      respondBy: "6pm on Friday 29 December",
      offerUrl: "https://celtaconnect.com/offer/sample",
      hoursLeftLabel: "Accept — 2 days left",
      nextCourseName: "March",
    }),
  },
  {
    key: "welcome",
    label: "Workspace ready",
    source: "full-email-specs.md item 11",
    html: welcomeEmailHtml({
      candidateName: "Sara",
      courseName: "C2/2024",
      centreName: "Meridian English Centre",
      tutorNames: ["Ramy Sakr", "Hakan Şen"],
      courseFact: "C2/2024, full-time 4 weeks",
      startsFact: "Monday 6 November, 9:00",
      preCourseTaskFact: "Pre-course task, about 4 hours",
      setupUrl: "https://celtaconnect.com/offer/sample",
      readingListUrl: "https://celtaconnect.com/resources?category=reading",
    }),
  },
];

export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const session = await getCurrentProfile();
  const profile = session?.profile;
  if (!profile) redirect("/login");
  if (profile.role !== "trainer" && profile.role !== "admin") redirect("/dashboard");

  const { email } = await searchParams;
  const active = SAMPLES.find((s) => s.key === email) ?? SAMPLES[0];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Connect · emails</p>
        <h1 className="mt-1 font-serif text-[26px] text-ink">What your centre sends</h1>
        <p className="mt-1 text-sm text-muted">
          Rendered exactly as they send, with the design files&apos; own sample names so you can hold this next to
          the source. Nothing here is real candidate data.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <Link
            key={s.key}
            href={`/dashboard/admin/email-preview?email=${s.key}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              s.key === active.key
                ? "border-ink bg-ink text-card"
                : "border-border text-muted hover:border-rule hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted">
        Source: <span className="text-ink">{active.source}</span>
      </p>

      {/*
        An iframe, not a div. These emails carry their own <html> and inline
        styles; dropping that markup into the page would let the app's
        stylesheet reach inside and show something the recipient will never
        see -- which is the one thing a preview must not do.
      */}
      <iframe
        title={`${active.label} preview`}
        srcDoc={active.html}
        className="h-[760px] w-full rounded-[8px] border border-border bg-white"
      />
    </div>
  );
}
