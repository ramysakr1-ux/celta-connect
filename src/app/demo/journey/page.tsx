import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/wordmark";
import {
  acknowledgementEmailHtml,
  interviewInvitationEmailHtml,
  interviewBookedEmailHtml,
  acceptancePlaceEmailHtml,
  welcomeEmailHtml,
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
              <p className="text-xs text-muted">
                The speaking task recording gets its own separate suggestion, independent of the reading above --
                never affects its lane or the autobook decision, just a starting point next to the audio:
              </p>
              <div className="rounded-[6px] border border-dashed border-border p-3">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">AI reading -- suggested, not sent</p>
                <p className="mt-1 text-sm text-ink">{sampleSpeakingSuggestion}</p>
              </div>
            </div>
          </Step>
          <Step number={4} title="Is invited to interview" blurb="Sent once the written task has been read.">
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
          <Step number={9} title="Gets their workspace" blurb="Sent once the centre releases access -- this is the CELTA Connect login link.">
            <EmailPreview title="Your CELTA workspace is ready" to={applicantName} html={welcomeHtml} />
          </Step>
        </div>

        <div className="flex flex-col gap-4">
          <p className="border-b-2 border-destructive pb-2 text-sm font-semibold tracking-[0.1em] text-destructive uppercase">
            The volunteer student&apos;s journey
          </p>

          <Step
            number={1}
            title="Signs up"
            blurb="No login, no application review -- a short form, freshly reset to the not-yet-signed-up state."
            href="/demo/journey/volunteer-signup"
            hrefLabel="Open the real signup form →"
          />
          <Step number={2} title="Gets a confirmation" blurb="Sent the moment they submit the form.">
            <EmailPreview title="Thanks for signing up" to="Grace Adeyemi" html={volunteerHtml} />
          </Step>
          <Step number={3} title="Gets notified their course is starting" blurb="A one-time email, once their course is within 7 days of starting -- carries their personal link.">
            <EmailPreview title="Your free English classes start Monday" to="Grace Adeyemi" html={volunteerClassStartingHtml} />
          </Step>
          <Step
            number={4}
            title="Sees their ongoing view"
            blurb="Upcoming sessions, shared materials, hours logged toward a certificate. 'Let them know' (decline a class) and 'Manage reminder emails' both live here too, not as separate pages."
            href="/demo/volunteer"
            hrefLabel="Open the ongoing volunteer view →"
          />
          <Step number={5} title="Gets a day-before reminder" blurb="20 hours before each class -- not a fixed clock time, and not 24 hours (that would land right at the previous day's class). Skipped if they declined this one, or turned reminder emails off.">
            <EmailPreview title="Your class is tomorrow" to="Grace Adeyemi" html={volunteerDayBeforeHtml} />
          </Step>
          <Step number={6} title="Gets a 30-minute reminder" blurb="Both an email and a browser push, independently -- push needs a permission grant per device, so the email is what actually reaches everyone.">
            <EmailPreview title="Your class starts in 30 minutes" to="Grace Adeyemi" html={volunteer30MinHtml} />
          </Step>
        </div>
      </div>
      <BackToTop />
    </div>
  );
}
