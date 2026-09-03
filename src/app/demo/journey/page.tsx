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
import { VolunteerJourneyMap } from "@/app/demo/journey/journey-map";
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

// Where a step lands, drawn as a chain rather than described in
// paragraphs. Ramy, 30 Aug 2026: "too much writing. Show, not tell...
// It's a visual journey, not an essay. I need them to see it, to feel it,
// to walk the journey with me."
//
// The first version of this was three paragraphs per step. Nobody reads
// three paragraphs standing over someone's shoulder. Each link is at most
// a handful of words and, where the destination is a real page, it opens
// it.
// Label and fact, nothing else. Replaces the paragraphs this page used to
// carry: the same content is here, but scannable while talking over it
// rather than read aloud.
function Facts({ caption, rows }: { caption: string; rows: [string, string][] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[6px] border border-border bg-card p-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{caption}</p>
      {rows.map(([label, fact]) => (
        <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <span className="shrink-0 text-xs font-bold text-ink sm:w-40">{label}</span>
          <span className="text-xs text-muted">{fact}</span>
        </div>
      ))}
    </div>
  );
}

function Ripple({ from, to }: { from: string; to: { where: string; what: string; href?: string }[] }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      <div className="flex items-center rounded-[6px] bg-ink px-3 py-2 text-xs font-semibold text-card">{from}</div>
      {to.map((t) => (
        <div key={t.where} className="flex items-stretch gap-2">
          <div className="flex items-center text-sm text-muted" aria-hidden>
            &rarr;
          </div>
          {t.href ? (
            <a
              href={t.href}
              className="trainee-hover-fill flex flex-col justify-center rounded-[6px] border border-primary/40 bg-primary/5 px-3 py-2"
            >
              <span className="text-[11px] font-bold tracking-[0.06em] text-primary uppercase">{t.where}</span>
              <span className="text-xs text-ink">{t.what}</span>
            </a>
          ) : (
            <div className="flex flex-col justify-center rounded-[6px] border border-border bg-card px-3 py-2">
              <span className="text-[11px] font-bold tracking-[0.06em] text-muted uppercase">{t.where}</span>
              <span className="text-xs text-ink">{t.what}</span>
            </div>
          )}
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
      when: "Wednesday 22 July, 10:00",
      markedTaskUrl: "https://celtaconnect.com/dashboard/admissions/<applicant>",
    }),
    centreName
  );
  // Every date below is one timeline, anchored on the course the rest of the
  // app actually runs: Monday 10 August to Friday 4 September 2026.
  //
  // It used to contradict itself in five ways at once, all visible on one
  // screen during a demo. "Monday 7 August" -- 7 Aug 2026 is a Friday, and
  // the course starts on the 10th everywhere else in the app. "Wednesday 27
  // August" -- a Thursday, and after the course had started. A deposit due 7
  // September and a balance due 1 October, i.e. three days and a month AFTER
  // the course finished. A waiting-list email saying a course that began 24
  // days ago "starts in 6 days", with a reply deadline four weeks after the
  // start. And the course was "at London" while the centre it belongs to is
  // Connect CELTA New York.
  //
  // Now: interview Wed 22 July, deposit Fri 24 July, balance Mon 3 August,
  // waiting-list reply Tue 4 August (six days out, as its own copy claims),
  // course starts Mon 10 August at 09:30 -- one time, not 9:00 in one email
  // and 09:30 in another.
  const offerHtml = withConnectBranding(
    acceptancePlaceEmailHtml({
      candidateName: applicantName,
      courseName,
      courseDates: "10 August – 4 September 2026",
      centreLocation: "New York",
      feeAmount: "£2,000",
      depositAmount: "£500",
      depositBy: "24 July 2026",
      balanceBy: "3 August 2026",
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
      startsFact: "Monday 10 August, 09:30",
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
      startDay: "Monday 10 August",
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
      interviewDate: "Wednesday 22 July",
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
      courseDates: "10 August to 4 September",
      startsInPhrase: "in 6 days",
      feeLine: "The fee is as set for this course;",
      respondBy: "Tuesday 4 August, 17:00 UTC",
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
      whenFact: "Monday 10 August, 09:30",
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
            href="/demo/journey/apply"
            hrefLabel="Apply — record yourself and submit →"
            caveat="The same form, the same recorder, the same server action, pointed at the demo centre. Submitting is safe: it lands in the demo pipeline and is wiped on the next rebuild."
          >
            {/* Ramy, 3 Sep 2026: "the recording part, the actual recording. I
                wanna be able to record myself... the whole process should be
                in the journey." The step above used to open Elmswood's LIVE
                form, captioned "look, don't submit" -- so the first
                interactive step of the journey was the one nobody could
                actually take. The demo form leads now; the live one stays
                below, for seeing a real centre's own prompts and branding. */}
            <a
              href="/apply"
              className="trainee-hover-fill inline-flex w-fit items-center rounded-[6px] border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-muted"
            >
              Or see {realCenter?.name ?? "the real centre"}&apos;s live form → (don&apos;t submit that one)
            </a>
          </Step>
          <Step number={2} title="Gets an acknowledgement" blurb="Sent the moment the form is submitted.">
            <EmailPreview title="We have your application" to={applicantName} html={ackHtml} />
          </Step>
          {/* Rewritten 30 Aug 2026. This step described passive visibility --
              "a staff member signs in, and the application is already
              there" -- when in fact five things fire before anyone opens a
              laptop. Ramy: "I thought it's all automated, and emails will be
              sent to various people. So what happens again when a candidate
              completes a pre-interview task?" He was right; the page was
              underselling its own product. Sequence below is read off
              src/app/apply/actions.ts, in the order it actually runs. */}
          <Step
            number={3}
            title="Five things happen before anyone opens a laptop"
            blurb="The pipeline is not somewhere an application waits to be noticed. Submitting one sets off the acknowledgement, the transcription, the notifications and -- if the centre has the reading turned on -- possibly an interview invitation."
          >
            <Facts
              caption="In this order, the moment they press submit"
              rows={[
                ["Acknowledgement", "sent at once, to everyone who applies -- deliberately generic, says nothing about the outcome"],
                ["Speaking task", "transcribed in the background; if that fails it fails silently rather than losing the application"],
                ["The right people", "email AND browser push to everyone holding admissions.manage -- not a shared inbox nobody owns"],
                ["Centre Management", "a live indicator lights for anyone with the page open, shared across all of them"],
                ["The reading", "only if the centre turned shadow mode on -- and it routes, it never rejects"],
              ]}
            />
            <Ripple
              from="Reading routes it"
              to={[
                { where: "Clear", what: "invite queues, sends in 15 min unless cancelled" },
                { where: "Clear problems", what: "a tutor is notified" },
                { where: "Borderline", what: "queued for a person" },
              ]}
            />
            <p className="text-xs text-muted">
              There is no fourth lane. The app never writes a rejection at any confidence &mdash; the worst outcome an
              automated reading can reach is &ldquo;a person should look at this&rdquo;.
            </p>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-muted">And when a staff member does sign in --</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/demo-journey/sign-in.png" alt="Connect sign-in page" className="w-full max-w-sm rounded-[6px] border border-border" />
              <p className="text-xs font-semibold text-muted">-- it is already there, alongside everyone else who has applied.</p>
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
            href="/demo/journey/interview-record"
            hrefLabel="Open the real interview record →"
            caveat="Opens as demo admissions staff, on the demo applicant's own page -- the questions drawn for them, the scoring and both signatures."
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
            <EmailPreview title={`${courseName} starts Monday 10 August`} to={applicantName} html={startsMondayHtml} />
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

          {/* The whole shape before the steps, so the point lands before
              anyone starts clicking: one volunteer signing up moves things
              on four other people's screens. */}
          <VolunteerJourneyMap />

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
            <Facts
              caption="The five screens"
              rows={[
                ["Their language", "Turkish, Arabic, Russian, Persian, Ukrainian, English -- becomes their L1 on file"],
                ["Six questions", "all optional; a blank answer moves on"],
                ["Two consents", "data on screen 2, recording on screen 4 -- one can be refused"],
                ["Eight prompts", "one continuous recording; each targets a tense, form or sound"],
                ["Why", "the same 2-3 minutes serves profile, language analysis and pronunciation"],
              ]}
            />
            <Ripple
              from="Grace records"
              to={[
                { where: "Candidate", what: "her L1, for the language analysis" },
                { where: "Tutor", what: "answers + transcript", href: "/demo/journey/volunteer-transcript" },
                { where: "Centre", what: "joins the volunteer pool" },
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
            <Ripple
              from="Grace attends"
              to={[
                { where: "Candidate", what: "shares TP handouts to her" },
                { where: "Tutor", what: "sees declines on the register" },
                { where: "Zoom", what: "join auto-marks attendance" },
                { where: "Centre + owner", what: "figures move" },
              ]}
            />
          </Step>

          <Step
            number={6}
            title="How the register actually decides they were there"
            blurb="Worth showing, because it is the one rule everybody assumes and nobody agrees on."
          >
            <Facts
              caption="The rule"
              rows={[
                ["90 minutes", "earns a tick -- and the tick credits the whole session, not the minutes"],
                ["Three marks", "under 45 absent, 45-89 recorded but credits nothing, 90+ credits"],
                ["Why partial exists", "turning up for one lesson is a different problem from never coming"],
                ["Zoom times", "shown, never counted -- the webhook fills the same present/absent row"],
                ["160 hours", "the centre's number; the volunteer's markers rescale to it"],
              ]}
            />
            <Ripple
              from="Register marked"
              to={[
                { where: "Volunteer", what: "hours and markers move" },
                { where: "Tutor", what: "present / partial / absent" },
                { where: "Centre + owner", what: "roll-up figures" },
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
            <Ripple
              from="Error logged"
              to={[
                { where: "Shared pool", what: "every candidate draws on it" },
                { where: "Tutor", what: "spot-check flags empty classes" },
                { where: "Assignment", what: "then CELTA 5, then grade form" },
              ]}
            />
          </Step>
        </div>
      </div>
      <BackToTop />
    </div>
  );
}
