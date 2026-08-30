import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/wordmark";
import {
  acknowledgementEmailHtml,
  applicationSubmittedEmailHtml,
  interviewInvitationEmailHtml,
  interviewBookedEmailHtml,
  acceptancePlaceEmailHtml,
  rejectionEmailHtml,
  rejectionAfterInterviewEmailHtml,
  placeFreedEmailHtml,
  notThisTimeEmailHtml,
  welcomeEmailHtml,
  startsMondayEmailHtml,
  volunteerSignedUpEmailHtml,
  volunteerClassStartingEmailHtml,
  volunteerSessionReminderEmailHtml,
  volunteer30MinReminderEmailHtml,
} from "@/lib/admissions-email";
import { withConnectBranding } from "@/lib/email-layout";
import Link from "next/link";
import { EmailPreview } from "@/app/demo/journey/email-preview";
import { BackToTop } from "@/app/demo/journey/back-to-top";
import { AiReadingPanel } from "@/app/dashboard/admissions/[id]/ai-reading-panel";

// Ramy, 2026-08-25: "one link... it will open all of them, and it will sort
// of tell the process, the journey" -- the application/interview/offer
// pipeline and the volunteer signup, laid out as two step-by-step
// timelines rather than the /demo page's grid of independent role entries.
// Each step is either a real link (the live public form/page, freshly reset
// where the underlying route isn't covered by the demo-write trigger -- see
// /demo/journey/interview, /offer, /volunteer-signup) or an inline preview
// of the email that stage actually sends, rendered from the same functions
// production uses (src/lib/admissions-email.ts), not paraphrased copies.
//
// Ramy, 25 Aug 2026: "it's still... quite slow." Nothing here is actually
// per-visitor -- every email preview is built from the same fixed sample
// data (Tariq Osei, Grace Adeyemi) every time, and the one real DB read
// (realCenter's name) barely ever changes. force-dynamic meant a full
// server re-render plus a DB round trip on literally every visit, with
// zero caching. A short revalidate window fixes that without going fully
// static (so a renamed real centre still shows up within a few minutes).
export const revalidate = 300;

// The point of the page, and the point of the product: no step stops at
// the person taking it. Ramy, 30 Aug 2026: "how each journey is connected
// to the trainees or to the center management or to the trainers, how it
// shows, where it shows, when it shows... That's the whole point of
// Connect. Everything is connected, and it needs to be clearly
// demonstrated through the journey."
//
// Every row below is a real read or write in the codebase, not a claim
// about intent. Where something is built but has never run against the
// live third party, it says so rather than implying it is proven.
function Connects({ rows }: { rows: { who: string; what: string; when: string }[] }) {
  return (
    <div className="flex flex-col gap-2 rounded-[6px] border border-primary/30 bg-primary/5 p-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-primary uppercase">
        What this sets off elsewhere
      </p>
      {rows.map((r) => (
        <div key={r.who + r.what} className="flex flex-col gap-0.5 border-b border-border-faint pb-2 last:border-b-0 last:pb-0">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[11px] font-bold tracking-[0.06em] text-ink uppercase">{r.who}</span>
            <span className="text-[11px] text-muted">{r.when}</span>
          </div>
          <p className="text-sm text-ink">{r.what}</p>
        </div>
      ))}
    </div>
  );
}

function Step({
  number,
  title,
  blurb,
  href,
  hrefLabel,
  caveat,
  children,
}: {
  number: number;
  title: string;
  blurb: string;
  href?: string;
  hrefLabel?: string;
  caveat?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sheet flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {number}
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="font-serif text-lg text-ink">{title}</p>
          <p className="text-sm text-muted">{blurb}</p>
        </div>
      </div>
      {href ? (
        <a href={href} className="trainee-hover-fill inline-flex w-fit items-center rounded-[6px] border border-border bg-card px-3.5 py-2 text-sm font-medium text-ink">
          {hrefLabel ?? "Open →"}
        </a>
      ) : null}
      {caveat ? <p className="text-xs text-status-warning-text">{caveat}</p> : null}
      {children}
    </div>
  );
}

// Matches the settings page's own labels (src/app/dashboard/admissions/
// settings/page.tsx) -- not exported from there, so kept in sync by hand
// rather than importing across an unrelated route boundary for one map.
const COVERAGE_LABEL: Record<string, string> = {
  motivation_suitability: "Motivation & suitability",
  language_awareness: "Language awareness",
  classroom_presence: "Classroom presence",
  flexibility_openness: "Flexibility & openness",
  digital_literacy: "Digital literacy",
  time_commitment: "Time commitment",
  other: "Other",
};

export default async function JourneyPage() {
  const admin = createAdminClient();
  const { data: realCenter } = await admin.from("centers").select("id, name").eq("is_demo", false).limit(1).maybeSingle();

  // Real, live content from the real centre's own interview question bank --
  // Ramy, 26 Aug 2026: "we wanna see the actual interview as well... do you
  // have that here? Interview questions." Not sample data like the rest of
  // this page: whatever the centre has actually configured in Settings.
  const { data: interviewQuestions } = realCenter
    ? await admin
        .from("interview_questions")
        .select("coverage_area, question_text")
        .eq("center_id", realCenter.id)
        .eq("active", true)
        .order("coverage_area")
    : { data: [] };

  // Ramy, 26 Aug 2026: "can we have the part where AI is checking it..."
  // -- Step 3 only described shadow-mode reading in a caveat line before;
  // this renders the real AiReadingPanel component (same one the real
  // admissions detail page uses) with representative sample data, the same
  // "actual component, not a paraphrase" approach the email steps already
  // take. Deliberately not all-clear -- "borderline" with one below-standard
  // row shows what the AI actually flags, not just a rubber stamp.
  // interview_auto_send_at is left null so the panel's own "Hold" form
  // (which posts to a real applicant id) never renders here.
  const sampleAiReading = {
    id: "demo",
    ai_reading_generated_at: new Date().toISOString(),
    ai_reading_lane: "borderline",
    interview_auto_send_at: null,
    interview_auto_send_cancelled_at: null,
    interview_auto_send_sent_at: null,
    ai_reading_summary: {
      language_awareness: { level: "above" as const, note: null },
      accuracy: { level: "at" as const, note: null },
      organisation: {
        level: "below" as const,
        note: "Paragraph 2 restates the topic without developing an argument -- no clear structure signposted.",
      },
      range: { level: "at" as const, note: null },
      substance: { level: "above" as const, note: null },
      summary:
        "Tariq shows strong topic knowledge and mostly accurate language, but the middle section loses structure -- worth a quick follow-up in interview to see if that's nerves or a genuine gap.",
    },
  };

  // Ramy, 28 Aug 2026: "update it with the logic we now have after
  // installing the API key" -- the OpenAI key unlocked four real features;
  // Step 3 already showed the written-task AiReadingPanel, but not this
  // second, separate one (speaking_task_ai_suggestion, read-speaking-
  // task.ts) -- standalone, never feeds the AiReadingPanel's lane or
  // autobook, same real component/copy the actual admissions page uses.
  const sampleSpeakingSuggestion =
    "Tariq speaks fluently with only occasional hesitation, and handles the follow-up question well. Range is solid for everyday topics but narrows on the more abstract prompt -- worth listening for how he handles unfamiliar vocabulary in interview.";

  const applicantName = "Tariq Osei";
  const courseName = "CELTA Demo Course";
  const centreName = "CELTA Demo Centre";

  // Every preview below goes through withConnectBranding, same as a real
  // send does in sendApplicantEmail -- otherwise this page would show the
  // pre-25-Aug look (no logo, no centre-name eyebrow) forever, quietly
  // drifting from what actually goes out. acknowledgementEmailHtml builds
  // its own emailShell() now (26 Aug 2026), so this just brands it directly
  // rather than wrapping it in a second shell.
  const ackHtml = withConnectBranding(acknowledgementEmailHtml({ applicantName, courseName }), centreName);
  const inviteHtml = withConnectBranding(
    interviewInvitationEmailHtml({
      applicantName,
      bookingUrl: "https://celtaconnect.com/interview/<token>",
      slotsNote: "3 times available this week -- reply if none suit you.",
    }),
    centreName
  );
  // Ramy, 27 Aug 2026: "it's not showing what happens with the speaking...
  // how the center gets notified" -- the journey page previously stopped at
  // the writing-task AI reading and never mentioned the notification that
  // actually fires on submission. Built exactly like every other email
  // preview here: the real function (notifyAdmissionsHandlers's
  // buildEmailHtml, src/lib/admissions-notify.ts), wrapped the same way
  // sendApplicantEmail wraps it for a real send.
  const submittedHtml = withConnectBranding(
    applicationSubmittedEmailHtml({
      recipientName: "Jordan Blake",
      applicantName,
      courseName,
      reviewUrl: "https://celtaconnect.com/dashboard/admissions/<applicant>",
    }),
    centreName
  );
  const bookedHtml = withConnectBranding(
    interviewBookedEmailHtml({
      recipientName: "Jordan Blake",
      applicantName,
      courseName,
      when: "Wednesday 27 August, 10:00",
      markedTaskUrl: "https://celtaconnect.com/dashboard/admissions/<applicant>",
    }),
    centreName
  );
  const offerHtml = withConnectBranding(
    acceptancePlaceEmailHtml({
      candidateName: applicantName,
      courseName,
      courseDates: "7 August – 4 September 2026",
      centreLocation: "London",
      feeAmount: "£2,000",
      depositAmount: "£500",
      depositBy: "7 September 2026",
      balanceBy: "1 October 2026",
      payUrl: null,
      officeContact: "admissions@celtaconnect.com",
      depositAlreadyPaid: false,
      directorName: "Jordan Blake",
      directorRole: "Main Course Tutor",
    }),
    centreName
  );
  // welcomeEmailHtml already builds its own shell, headed "Your CELTA
  // workspace is ready" -- not "Welcome to Connect". Ramy, 26 Aug 2026:
  // "there's no welcome to Connect... it'd be welcome to [the course],
  // and then the centre name" -- this demo page was the one that had it
  // wrong, wrapping the real function's output in a second, invented shell.
  const welcomeHtml = withConnectBranding(
    welcomeEmailHtml({
      candidateName: applicantName,
      courseName,
      centreName,
      tutorNames: ["Jordan Blake", "Marcus Webb"],
      courseFact: "7 Aug – 4 Sept 2026, full-time",
      startsFact: "Monday 7 August, 9:00",
      preCourseTaskFact: "Due before day one",
      setupUrl: "https://celtaconnect.com/join/<token>",
      readingListUrl: null,
    }),
    centreName
  );
  // Ramy, 28 Aug 2026: "the second email would be getting to know you and
  // the answer key" -- the real Friday-before-start email
  // (starts-monday-cron.ts's own comment: "carries the link to their
  // day-one activity, because that is the first moment levels and groups
  // exist"), built and sending for real but never shown in this journey.
  // The answer key itself has no separate email -- it's a pure date gate
  // computed live in pre-course-task/page.tsx (answerKeyOpensOn), the same
  // 48-hours-before-start date this email now fires on, not a second date
  // to track.
  const startsMondayHtml = withConnectBranding(
    startsMondayEmailHtml({
      candidateName: applicantName,
      courseName,
      startTime: "09:30",
      startDay: "Monday 7 August",
      room: `at ${centreName}`,
      groupName: "ABC",
      levelName: "intermediate",
      tutorNames: "Jordan Blake and Marcus Webb",
      activitiesUrl: "https://celtaconnect.com/portfolio/<trainee>/gtky",
      directorName: "Jordan Blake",
      directorRole: "Course Director",
    }),
    centreName
  );
  // Ramy, 28 Aug 2026: "some receive an interview appointment, and some
  // receive a rejection letter" -- the real branch point, missing from
  // this journey entirely until now. Two distinct rejection emails exist
  // for two distinct moments (before ever meeting them, and after a real
  // interview) -- twenty-decisions.md 11a: never automatic, always a
  // human's own words in `reason`.
  const rejectionHtml = withConnectBranding(
    rejectionEmailHtml({
      applicantName: "Priya Sharma",
      centreName,
      reason:
        "The written task showed some strong moments, but the language-awareness section wasn't yet at the level this course needs to build on -- specifically explaining word order in reported speech.",
    }),
    centreName
  );
  const rejectionAfterInterviewHtml = withConnectBranding(
    rejectionAfterInterviewEmailHtml({
      applicantName: "Daniel Kim",
      interviewDate: "Wednesday 27 August",
      reason:
        "We talked through how you'd handle being observed teaching from week one, and I don't think this course's pace is the right fit yet -- come back to it once you've had more time in front of a class.",
    }),
    centreName
  );
  // Ramy, 28 Aug 2026: "what happens if they pass the interview but the
  // course is full?" -- the real waiting-list mechanism, same three-way
  // decision point as offer/reject: position + a real "hear either way by"
  // date, then two real automatic outcomes -- offered the moment a place
  // frees up (place_freed), or a dedicated "not this time" if that date
  // passes with nothing (admissions-cron.ts's nightly check).
  const placeFreedHtml = withConnectBranding(
    placeFreedEmailHtml({
      applicantName: "Priya Sharma",
      courseName,
      courseDates: "7 August to 4 September",
      startsInPhrase: "in 6 days",
      feeLine: "The fee is as set for this course;",
      respondBy: "Wednesday 2 September, 17:00 UTC",
      offerUrl: "https://celtaconnect.com/offer/<token>",
      hoursLeftLabel: "Accept your place",
      nextCourseName: null,
    }),
    centreName
  );
  const notThisTimeHtml = withConnectBranding(
    notThisTimeEmailHtml({
      applicantName: "Priya Sharma",
      courseName,
      positionWord: "3rd",
      nextCourseName: null,
      nextCourseStart: null,
    }),
    centreName
  );
  const volunteerHtml = withConnectBranding(
    volunteerSignedUpEmailHtml({ volunteerName: "Grace Adeyemi", centreName }),
    centreName
  );
  const volunteerClassStartingHtml = withConnectBranding(
    volunteerClassStartingEmailHtml({
      centreName,
      levelName: "B1",
      classFact: courseName,
      whenFact: "Monday 7 August, 09:30",
      joinUrl: "https://celtaconnect.com/student/<token>",
    }),
    centreName
  );
  const volunteerDayBeforeHtml = withConnectBranding(
    volunteerSessionReminderEmailHtml({
      classFact: "B1 English lesson",
      dayFact: "Day 4",
      whenFact: "Friday 28 August, 10:00",
      joinUrl: "https://celtaconnect.com/student/<token>",
      unsubscribeUrl: "https://celtaconnect.com/student/<token>/unsubscribe",
    }),
    centreName
  );
  const volunteer30MinHtml = withConnectBranding(
    volunteer30MinReminderEmailHtml({
      classFact: "B1 English lesson",
      dayFact: "Day 4",
      whenFact: "Friday 28 August, 10:00",
      joinUrl: "https://celtaconnect.com/student/<token>",
      unsubscribeUrl: "https://celtaconnect.com/student/<token>/unsubscribe",
    }),
    centreName
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container flex flex-col gap-10 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <Link href="/" className="hover:opacity-80">
            <Wordmark size="hero" />
          </Link>
          <h1 className="font-serif text-2xl text-ink">The application journey</h1>
          <p className="max-w-lg text-sm text-muted">
            Every stage a real trainee or volunteer goes through, in order -- the live form or page where there is
            one, and the actual email Connect sends at that point where there isn&apos;t.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <p className="border-b-2 border-destructive pb-2 text-sm font-semibold tracking-[0.1em] text-destructive uppercase">
            The trainee&apos;s journey
          </p>

          <Step
            number={1}
            title="Applies"
            blurb="The public application form -- name, an extended writing task, a recorded speaking task, and a language-awareness check, plus the acknowledgements. Together these three are the pre-interview task."
            href="/apply"
            hrefLabel="Open the real application form →"
            caveat={`This is the live form for ${realCenter?.name ?? "the real centre"} -- the same one real applicants use. Look, don't submit.`}
          />
          <Step number={2} title="Gets an acknowledgement" blurb="Sent the moment the form is submitted.">
            <EmailPreview title="We have your application" to={applicantName} html={ackHtml} />
          </Step>
          <Step
            number={3}
            title="Lands in the admissions pipeline"
            blurb="Immediately, and visible to any staff member who signs in -- not just whoever happens to check their email."
          >
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted">A staff member signs in --</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo-journey/sign-in.png" alt="Connect sign-in page" className="w-full max-w-sm rounded-[6px] border border-border" />
              <p className="text-xs font-semibold text-muted">-- and the application is already there, alongside everyone else who&apos;s applied.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/demo-journey/admissions-pipeline.png"
                alt="Admissions pipeline showing the new application"
                className="w-full max-w-xl rounded-[6px] border border-border"
              />
              <p className="text-xs text-muted">
                If the centre has turned on AI shadow-mode reading (off by default), a private reading against the
                marking scheme is also recorded right on this applicant&apos;s page -- never shown to them, never
                auto-rejects anyone. Here&apos;s what that reading actually looks like:
              </p>
              <AiReadingPanel applicant={sampleAiReading} />

              <p className="mt-2 text-xs text-muted">
                The recorded speaking task is transcribed automatically (fails silently if it can&apos;t -- a missing
                transcript never blocks the application) and read for a short advisory note, shown separately on the
                same applicant page:
              </p>
              <div className="rounded-[6px] border border-border bg-card p-3">
                <p className="text-xs font-semibold text-muted">Speaking task</p>
                <p className="mt-1 text-sm text-ink">
                  &quot;Tell us about a time you had to adapt your communication style for a new audience.&quot;
                </p>
                <p className="mt-2 text-xs text-muted">0:47 recording -- played back exactly as submitted.</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-primary">Transcript</summary>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-ink">
                    So, um, a good example would be when I was tutoring a group of teenagers after mostly doing adult
                    classes for years. I had to slow down, use a lot more visual support, and check in more often
                    because they wouldn&apos;t always say when they were lost. It taught me to read the room rather
                    than just deliver the plan I&apos;d prepared.
                  </p>
                </details>
                <div className="mt-2 rounded-[6px] border border-dashed border-border p-2.5">
                  <p className="text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">AI reading -- suggested, not sent</p>
                  <p className="mt-1 text-sm text-ink">{sampleSpeakingSuggestion}</p>
                </div>
              </div>

              <p className="mt-2 text-xs font-semibold text-muted">And admissions staff are notified immediately --</p>
              <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-border bg-card p-3">
                <span
                  aria-hidden="true"
                  title="New admissions activity -- click to clear"
                  className="size-2.5 shrink-0 animate-pulse rounded-full bg-destructive"
                />
                <p className="text-sm text-ink">
                  A live dot next to &quot;Admissions pipeline&quot; on Centre Management&apos;s overview, for anyone
                  with the page open -- stays lit until someone clicks it, shared across every staff member who can
                  see it. Alongside a push notification to every device that&apos;s enabled them. No chime for this
                  one specifically -- the sound toggle is a separate, opt-in feature on staff chat, not wired to
                  admissions.
                </p>
              </div>
              <EmailPreview title="New application" to="Jordan Blake (MCT)" html={submittedHtml} />
            </div>
          </Step>
          <p className="ml-8 max-w-2xl text-xs text-muted">
            Neither of the next two happens automatically for everyone. If AI shadow-mode reading is on and this
            applicant is clear on every criterion, an interview invite queues itself and sends 15 minutes later --
            unless a staff member cancels it first. Everyone else gets nothing automatic: a real person on the admin
            or MCT side reads the application themselves and manually sends one of the two below.
          </p>
          <div className="ml-8 flex flex-col gap-2 border-l-2 border-dashed border-destructive/40 pl-4">
            <p className="text-xs font-semibold text-destructive">Manually sent -- decided not to proceed</p>
            <EmailPreview title="We are not taking your application further" to="Priya Sharma" html={rejectionHtml} />
          </div>
          <Step
            number={4}
            title="Is invited to interview"
            blurb="Either the 15-minute autobook (clear on every criterion, if the centre has that on) or a staff member sending it manually -- same email either way."
          >
            <EmailPreview title="We would like to meet you" to={applicantName} html={inviteHtml} />
          </Step>
          <Step
            number={5}
            title="Books a time"
            blurb="The link from that email -- freshly reset, always has an open slot."
            href="/demo/journey/interview"
            hrefLabel="Open the real booking page →"
          />
          <Step number={6} title="Tutors are notified" blurb="Sent to staff, not the applicant, the moment a slot is booked.">
            <EmailPreview title="Interview booked" to="Jordan Blake (MCT)" html={bookedHtml} />
          </Step>
          <Step
            number={7}
            title="The interview itself"
            blurb="Seven fixed questions from the centre's own bank, plus two more drawn per applicant from whatever the task reading flagged as weak. Both the interviewer and the candidate sign the record afterward."
          >
            {interviewQuestions && interviewQuestions.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted">
                  {realCenter?.name ?? "The centre"}&apos;s own live question bank, right now:
                </p>
                <ul className="flex flex-col gap-2">
                  {interviewQuestions.map((q, i) => (
                    <li key={i} className="rounded-[6px] border border-border bg-card p-3">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                        {COVERAGE_LABEL[q.coverage_area] ?? q.coverage_area}
                      </span>
                      <p className="text-sm text-ink">{q.question_text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted">No active questions configured yet.</p>
            )}
          </Step>
          <div className="ml-8 flex flex-col gap-2 border-l-2 border-dashed border-destructive/40 pl-4">
            <p className="text-xs font-semibold text-destructive">OR -- meeting them changes the decision</p>
            <EmailPreview title="We are not able to offer you a place this time" to="Daniel Kim" html={rejectionAfterInterviewHtml} />
          </div>
          <div className="ml-8 flex flex-col gap-2 border-l-2 border-dashed border-status-warning-text/50 pl-4">
            <p className="text-xs font-semibold text-status-warning-text">
              OR -- they&apos;re a clear yes, but the course is full: waiting list, with a real date they&apos;ll hear
              either way -- their task and interview stay on file, they never repeat them
            </p>
            <EmailPreview title="A place has come free — it is yours if you want it" to="Priya Sharma" html={placeFreedHtml} />
            <p className="text-xs text-muted">
              Sent automatically the moment a real place opens -- withdrawal, deferral, or an unaccepted offer lapsing.
              48 hours to respond, same accept-page as any offer.
            </p>
            <EmailPreview title="The course filled before a place came free" to="Priya Sharma" html={notThisTimeHtml} />
            <p className="text-xs text-muted">
              Or, if their own hear-by date passes first with nothing freed -- sent automatically by the nightly job,
              nobody left waiting past the date they were promised.
            </p>
          </div>
          <Step
            number={8}
            title="Receives an offer"
            blurb="Sent once a decider records an offer -- deposit, dates, and how to accept."
            href="/demo/journey/offer"
            hrefLabel="View the real offer page →"
            caveat="Accepting creates a real login account -- freshly reset for viewing, but don't submit it live."
          >
            <EmailPreview title="Your place on CELTA Demo Course" to={applicantName} html={offerHtml} />
          </Step>
          {/* The trainee's counterpart to the volunteer journey's step 4.
              /demo/trainee has existed all along -- it mints a real magic
              link and lands on Amara Okafor's actual portfolio -- but this
              page never linked to it, so the trainee journey showed the
              email announcing the workspace and then never opened it, while
              the volunteer journey walked you straight in. Ramy, 30 Aug
              2026: "do the same thing for the trainee." */}
          <Step
            number={9}
            title="Gets their workspace"
            blurb="Sent once the centre releases access -- this is the CELTA Connect login link."
            href="/demo/trainee"
            hrefLabel="Open the real trainee workspace &rarr;"
          >
            <EmailPreview title="Your CELTA workspace is ready" to={applicantName} html={welcomeHtml} />
          </Step>
          <Step
            number={10}
            title="Does the pre-course task and the scavenger hunt"
            blurb="What they actually land on, not just what the email says -- Cambridge's real 5-section task plus the 'find your way around Connect' hunt, self-resolving as they actually navigate to each place. Both real, live components."
            href="/demo/trainee-precourse"
            hrefLabel="Open the real page →"
          />
          <Step
            number={11}
            title="Gets notified the course starts Monday"
            blurb="Sent the Friday immediately before start -- the first moment groups and levels actually exist, so this is also the first message carrying their real group and the link to the day-one activity."
          >
            <EmailPreview title={`${courseName} starts Monday 7 August`} to={applicantName} html={startsMondayHtml} />
          </Step>
          <Step
            number={12}
            title="Picks their day-one activity"
            blurb="The GTKY pick -- three getting-to-know-you activities, per group not per trainee. If nobody picks, the tutor picks for the group automatically the same Friday."
            href="/demo/trainee-gtky"
            hrefLabel="Open the real page →"
          />
        </div>

        <div className="flex flex-col gap-4">
          <p className="border-b-2 border-destructive pb-2 text-sm font-semibold tracking-[0.1em] text-destructive uppercase">
            The volunteer student&apos;s journey
          </p>

          {/* Rewritten 30 Aug 2026. The old six steps described the signup
              as "a short form" and stopped at the reminder emails, so the
              journey never showed the thing the signup exists FOR -- the
              recording, the transcript, and the pooled evidence a candidate
              writes their Focus on the Learner assignment from. Ramy, having
              to say it twice: "the volunteer students also logging online
              and answering the questions for the assignment for FOL and
              recording themselves. And then what happens to that recording?
              Where does it go? Where does it land?"

              Every step below either opens the real page or shows the real
              email. Nothing here is a mockup, and nothing describes
              something that is not built. */}
          <Step
            number={1}
            title="Signs up -- and this is where the FOL evidence comes from"
            blurb="No login and no application review: the link itself is the only auth. Five screens -- their own language first, then data consent, six optional written questions, a separate recording consent, and eight prompts. Freshly reset to the not-yet-signed-up state on every visit."
            href="/demo/journey/volunteer-signup"
            hrefLabel="Open the real signup, from the start &rarr;"
          >
            <div className="flex flex-col gap-2 rounded-[6px] border border-border bg-card p-3">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">What the five screens ask</p>
              <p className="text-sm text-ink">
                <span className="font-semibold">Their language.</span> Turkish, Arabic, Russian, Persian, Ukrainian or
                English, plus &quot;my language is not here&quot;. Whatever they pick becomes their L1 on file, which is
                what makes the language analysis in the assignment possible at all.
              </p>
              <p className="text-sm text-ink">
                <span className="font-semibold">Six written questions, every one optional.</span> A blank answer moves
                on. Nobody is blocked from volunteering by a form.
              </p>
              <p className="text-sm text-ink">
                <span className="font-semibold">Two separate consents.</span> Data on screen two, recording on screen
                four. Someone can agree to one and refuse the other.
              </p>
              <p className="text-sm text-ink">
                <span className="font-semibold">Eight prompts, one continuous recording.</span> &quot;Next question&quot;
                advances the prompt; the recording never stops. The prompts escalate, and each is chosen to elicit a
                particular tense, form or sound -- so the same two or three minutes serves the learner profile, the
                language analysis and the pronunciation work at once, instead of asking a volunteer to sit through
                three separate exercises.
              </p>
            </div>
            <Connects
              rows={[
                {
                  who: "The candidate",
                  when: "from the moment it saves",
                  what: "The language they chose becomes their L1 on file -- which is what makes the language-analysis half of Focus on the Learner possible at all. Without it a candidate is guessing at first-language interference.",
                },
                {
                  who: "The tutor",
                  when: "as soon as transcription finishes",
                  what: "The written answers and the transcript appear against that volunteer on the Volunteers page, so a tutor can see who is in the room before they walk into it.",
                },
                {
                  who: "Centre Management",
                  when: "immediately",
                  what: "They join the centre's volunteer pool, grouped as a person rather than a row per course -- so someone who volunteers on three courses is one human being with a history, not three strangers.",
                },
              ]}
            />
          </Step>

          <Step number={2} title="Gets a confirmation" blurb="Sent the moment they submit the form.">
            <EmailPreview title="Thanks for signing up" to="Grace Adeyemi" html={volunteerHtml} />
          </Step>

          <Step
            number={3}
            title="The recording is transcribed, and lands where a tutor can use it"
            blurb="The profile row saves immediately with no transcript, so nobody is left watching a spinner after they have already finished talking. Transcription then runs on its own and fills it in. If it fails, it fails silently -- a missing transcript never blocks a signup or loses the audio."
            href="/demo/journey/volunteer-transcript"
            hrefLabel="Open the real Volunteers page, where the transcript lands &rarr;"
          />

          <Step number={4} title="Gets notified their course is starting" blurb="A one-time email, once their course is within 7 days of starting -- carries their personal link.">
            <EmailPreview title="Your free English classes start Monday" to="Grace Adeyemi" html={volunteerClassStartingHtml} />
          </Step>

          <Step
            number={5}
            title="Sees their ongoing view"
            blurb="The same link, now past the signup. Next class, every class with the handouts for it, and hours logged toward a certificate -- with progress markers scaled to whatever threshold the centre has set, not a fixed 40/80/120/160. Joining the class online, declining one, and managing reminder emails all live here rather than as separate pages."
            href="/demo/volunteer"
            hrefLabel="Open the ongoing volunteer view &rarr;"
          >
            <Connects
              rows={[
                {
                  who: "The candidate",
                  when: "the moment they tick 'share' on a TP plan",
                  what: "The handouts a volunteer sees here are not centre stock -- they are the candidate's own teaching-practice materials, shared straight off their lesson plan. The person being taught gets the actual worksheet the person teaching them made.",
                },
                {
                  who: "The tutor",
                  when: "when a class is declined",
                  what: "'Let them know' takes them off that class on the register, so a tutor plans for who is actually coming rather than discovering it in the room. It also suppresses that class's reminders -- nobody is nagged about a class they already said they would miss.",
                },
                {
                  who: "Attendance, automatically",
                  when: "on joining the Zoom class",
                  what: "A Zoom webhook records the join against that session -- first join kept, so a rejoin does not reset it -- which credits the hours toward their certificate without anyone ticking a register. Built and wired; it has not yet been exercised against a live Zoom account, so treat it as a demo of the mechanism rather than a proven integration.",
                },
                {
                  who: "Centre Management and the platform owner",
                  when: "continuously",
                  what: "Those same attendance rows roll up into the centre's volunteer figures and into Command Center's people view -- one volunteer showing up to one class moves a number on the owner's screen.",
                },
                {
                  who: "Business and admissions staff",
                  when: "whenever they need it",
                  what: "They get a no-login register link of their own -- view and add volunteers, nothing else. No account, and no access to the course itself.",
                },
              ]}
            />
          </Step>

          <Step
            number={6}
            title="How the register actually decides they were there"
            blurb="Worth showing, because it is the one rule everybody assumes and nobody agrees on."
          >
            <div className="flex flex-col gap-2 rounded-[6px] border border-border bg-card p-3">
              <p className="text-sm text-ink">
                <span className="font-semibold">90 minutes in a day earns a tick, and the tick credits the whole
                session.</span> Sit through 90 minutes of a 2&frac14;-hour day and you are credited 2&frac14; hours,
                not 90 minutes. Nothing part-credits.
              </p>
              <p className="text-sm text-ink">
                <span className="font-semibold">Three marks, not two.</span> Under 45 minutes is absent. 45 to 89 is
                its own mark on the register -- it credits no hours, but it is recorded, because a tutor looking at
                someone who repeatedly turns up for one lesson has a different problem from someone who never comes,
                and a two-state register hides that difference.
              </p>
              <p className="text-sm text-ink">
                <span className="font-semibold">Minute-level credit was deliberately not built.</span> A teaching
                practice slot is a fixed-length block someone is present or absent for; counting attended blocks
                against the block length reproduces the same rule without pretending to per-minute data nobody
                actually has.
              </p>
              <p className="text-sm text-ink">
                <span className="font-semibold">Zoom join and leave times are shown, not counted.</span> The webhook
                fills in the same present/absent row a tutor would tick by hand. The timestamps are there to look at;
                they are not a second, competing input to the hours.
              </p>
              <p className="text-sm text-ink">
                <span className="font-semibold">The threshold is the centre&apos;s, not ours.</span> 160 hours by
                default, changed per centre in settings, and the progress markers on the volunteer&apos;s own page
                rescale to whatever it is set to -- quarters of the real threshold, rather than a hard-coded
                40/80/120/160 that stops making sense the moment a centre changes it.
              </p>
            </div>
            <Connects
              rows={[
                {
                  who: "The volunteer",
                  when: "every time the register is marked",
                  what: "Their own page moves: hours credited, hours remaining, and how far along the four markers they are.",
                },
                {
                  who: "The tutor",
                  when: "on the register",
                  what: "Sees present, partial and absent as three distinct marks per session, per volunteer.",
                },
                {
                  who: "Centre Management and Command Center",
                  when: "continuously",
                  what: "The same rows aggregate into the centre's volunteer figures and the platform owner's people view.",
                },
              ]}
            />
          </Step>

          <Step
            number={7}
            title="And at the end of a level, a certificate of attendance"
            blurb="The centre's own document -- its logo, its name, its signatories, and deliberately no Cambridge mark and no Connect mark, because it is a document that leaves the system and carries the centre's brand alone."
            href="/demo/journey/volunteer-certificate"
            hrefLabel="Open the certificate &rarr;"
            caveat="Design only, and shown here from sample data. The cross-course level tracking that would decide a volunteer has finished a level is not built yet, so nothing issues this automatically today."
          />

          <Step number={8} title="Gets a day-before reminder" blurb="20 hours before each class -- not a fixed clock time, and not 24 hours (that would land right at the previous day's class). Skipped if they declined this one, or turned reminder emails off.">
            <EmailPreview title="Your class is tomorrow" to="Grace Adeyemi" html={volunteerDayBeforeHtml} />
          </Step>

          <Step number={9} title="Gets a 30-minute reminder" blurb="Both an email and a browser push, independently -- push needs a permission grant per device, so the email is what actually reaches everyone.">
            <EmailPreview title="Your class starts in 30 minutes" to="Grace Adeyemi" html={volunteer30MinHtml} />
          </Step>

          <Step
            number={10}
            title="And the candidates write their assignment from all of it"
            blurb="This is what the whole journey feeds. Candidates log a learner's error by tapping that learner from the register mid-observation, Days 2 to 9, into one shared pool -- so the evidence is gathered by the whole group rather than each candidate cornering a volunteer separately. The claim they submit is adjudicated by the system, not queued for a tutor: four soft checks that can be retried immediately, and only two things that actually block -- a duplicate, or genuinely no evidence at all."
            href="/demo/trainee"
            hrefLabel="Open a candidate's workspace &rarr;"
          >
            <p className="text-xs text-muted">
              Tutors get a spot-check view of their own, showing per-class log counts and flagging any class sitting at
              nearly zero entries -- reachable from the roster&apos;s &quot;FOL pool, by class&quot; row.
            </p>
            <Connects
              rows={[
                {
                  who: "Every other candidate",
                  when: "as each error is logged",
                  what: "One shared pool, not one per candidate. Nobody has to corner a volunteer on their own, and a quiet learner still generates evidence because the whole group is watching.",
                },
                {
                  who: "The tutor",
                  when: "Days 2 to 9, while it can still be fixed",
                  what: "The spot-check flags a class sitting at nearly zero entries -- so a group that is not gathering evidence is caught during the course, not at marking.",
                },
                {
                  who: "The assignment, then the CELTA 5",
                  when: "at submission and at marking",
                  what: "The claim is adjudicated by the system rather than queued for a tutor: four soft checks a candidate can retry immediately, and only two hard blockers -- a duplicate, or genuinely no evidence. What survives becomes assignment evidence, which becomes a criterion tick on the CELTA 5, which becomes a line on the grade form the assessor reads.",
                },
              ]}
            />
          </Step>
        </div>
      </div>
      <BackToTop />
    </div>
  );
}
