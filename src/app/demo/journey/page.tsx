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
import { emailShell, withConnectBranding } from "@/lib/email-layout";
import { EmailPreview } from "@/app/demo/journey/email-preview";
import { BackToTop } from "@/app/demo/journey/back-to-top";

// Ramy, 2026-08-25: "one link... it will open all of them, and it will sort
// of tell the process, the journey" -- the application/interview/offer
// pipeline and the volunteer signup, laid out as two step-by-step
// timelines rather than the /demo page's grid of independent role entries.
// Each step is either a real link (the live public form/page, freshly reset
// where the underlying route isn't covered by the demo-write trigger -- see
// /demo/journey/interview, /offer, /volunteer-signup) or an inline preview
// of the email that stage actually sends, rendered from the same functions
// production uses (src/lib/admissions-email.ts), not paraphrased copies.
export const dynamic = "force-dynamic";

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

export default async function JourneyPage() {
  const admin = createAdminClient();
  const { data: realCenter } = await admin.from("centers").select("name").eq("is_demo", false).limit(1).maybeSingle();

  const applicantName = "Tariq Osei";
  const courseName = "CELTA Demo Course";
  const centreName = "Connect CELTA Demo Centre";

  // Every preview below goes through withConnectBranding, same as a real
  // send does in sendApplicantEmail -- otherwise this page would show the
  // pre-25-Aug look (no logo, no centre-name eyebrow) forever, quietly
  // drifting from what actually goes out.
  const ackHtml = withConnectBranding(
    emailShell({
      heading: "We have your application",
      tone: "teal",
      body: acknowledgementEmailHtml({ applicantName, courseName, hearBy: "10 September 2026" }),
    }),
    centreName
  );
  const inviteHtml = withConnectBranding(
    interviewInvitationEmailHtml({
      applicantName,
      bookingUrl: "https://celtaconnect.com/interview/<token>",
      slotsNote: "3 times available this week -- reply if none suit you.",
    }),
    centreName
  );
  const bookedHtml = withConnectBranding(
    emailShell({
      heading: "Interview booked",
      tone: "teal",
      body: interviewBookedEmailHtml({
        recipientName: "Jordan Blake",
        applicantName,
        courseName,
        when: "Wednesday 27 August, 10:00",
        markedTaskUrl: "https://celtaconnect.com/dashboard/admissions/<applicant>",
      }),
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
  const welcomeHtml = withConnectBranding(
    emailShell({
      heading: "Welcome to Connect",
      tone: "teal",
      body: welcomeEmailHtml({
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
    }),
    centreName
  );
  const volunteerHtml = withConnectBranding(
    emailShell({
      heading: "Thanks for signing up",
      tone: "teal",
      body: volunteerSignedUpEmailHtml({ volunteerName: "Grace Adeyemi", centreName }),
    }),
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
          <Wordmark size="hero" />
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
            blurb="The public application form -- name, task responses, acknowledgements."
            href="/apply"
            hrefLabel="Open the real application form →"
            caveat={`This is the live form for ${realCenter?.name ?? "the real centre"} -- the same one real applicants use. Look, don't submit.`}
          />
          <Step number={2} title="Gets an acknowledgement" blurb="Sent the moment the form is submitted.">
            <EmailPreview title="We have your application" to={applicantName} html={ackHtml} />
          </Step>
          <Step number={3} title="Is invited to interview" blurb="Sent once the written task has been read.">
            <EmailPreview title="We would like to meet you" to={applicantName} html={inviteHtml} />
          </Step>
          <Step
            number={4}
            title="Books a time"
            blurb="The link from that email -- freshly reset, always has an open slot."
            href="/demo/journey/interview"
            hrefLabel="Open the real booking page →"
          />
          <Step number={5} title="Tutors are notified" blurb="Sent to staff, not the applicant, the moment a slot is booked.">
            <EmailPreview title="Interview booked" to="Jordan Blake (MCT)" html={bookedHtml} />
          </Step>
          <Step
            number={6}
            title="Receives an offer"
            blurb="Sent once a decider records an offer -- deposit, dates, and how to accept."
            href="/demo/journey/offer"
            hrefLabel="View the real offer page →"
            caveat="Accepting creates a real login account -- freshly reset for viewing, but don't submit it live."
          >
            <EmailPreview title="Your place on CELTA Demo Course" to={applicantName} html={offerHtml} />
          </Step>
          <Step number={7} title="Gets their workspace" blurb="Sent once the centre releases access -- this is the CELTA Connect login link.">
            <EmailPreview title="Welcome to Connect" to={applicantName} html={welcomeHtml} />
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
