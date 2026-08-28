import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

// Ramy, 29 Aug 2026, after checking the Administration Handbook: "what
// should the trainees have the right to see?"
//
// §6.3 requires a candidate agreement given to candidates BEFORE the course
// starts, and names what it must cover. /terms already existed but is a
// platform agreement -- IP, data, AI use, assignment fingerprinting -- and
// covers almost none of §6.3. This is the CELTA agreement the Handbook
// actually asks for, and it is deliberately a separate document: one is
// about using Connect, the other about being a candidate on a course.
//
// §6.2's Internal Complaints Procedure is folded in as section 12, which
// the Handbook explicitly permits ("can be included within a candidate
// agreement").
//
// Where a clause states a rule Connect really enforces, it says so plainly.
// Where the Handbook requires a CENTRE policy that only the centre can set
// -- refunds, facilities, technological requirements -- it is marked
// [CENTRE TO COMPLETE] rather than invented. A drafted placeholder that
// reads as settled policy is worse than an obvious blank, because nobody
// goes back and fills in prose that already sounds finished.

const HANDBOOK = "CELTA Administration Handbook, June 2025";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold text-ink">
        {n}. {title}
      </h2>
      <div className="mt-1.5 flex flex-col gap-2 text-sm text-muted">{children}</div>
    </section>
  );
}

function ToComplete({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[6px] border border-dashed border-border bg-surface-muted px-3 py-2 text-sm">
      <span className="font-semibold text-ink">[Centre to complete]</span> {children}
    </p>
  );
}

function ToCompleteList() {
  // Ramy, 29 Aug 2026: "it should be clear -- the centre's stand and
  // whether it's AI or plagiarism from the internet, what the penalty is.
  // Maybe stated in the form that assignment five is an automatic fail, or
  // immediate resubmission, something like that."
  //
  // He is right that a candidate needs the specific consequence, not "may
  // mean". But the outcomes are genuinely centre-set: Connect stores them
  // per centre in malpractice_outcome_options, and a centre configures its
  // own list (Elmswood currently has two, "Not upheld" and "Upheld,
  // assignment failed"). Writing an invented scale here would state as
  // policy something the centre has not decided and the app would not
  // enforce.
  return (
    <div className="rounded-[6px] border border-dashed border-border bg-surface-muted px-3 py-2 text-sm">
      <p>
        <span className="font-semibold text-ink">[Centre to complete]</span> Set out the actual consequence for each
        case, so a candidate can read it before they are ever in one. For example: whether a first upheld case fails
        that assignment outright or allows a resubmission; whether a resubmission is still available afterwards or is
        forfeited; and what a second upheld case means for finishing the course.
      </p>
      <p className="mt-1.5 text-xs">
        These must match the outcomes configured for this centre in Connect, so what a candidate is told here and what
        a tutor can actually record are the same list.
      </p>
    </div>
  );
}

export default function CandidateAgreementPage() {
  return (
    <div className="flex min-h-screen flex-1 justify-center p-8">
      <div className="sheet w-full max-w-2xl p-8">
        <Link href="/" className="inline-block hover:opacity-80">
          <Wordmark size="header" />
        </Link>
        <h1 className="mt-6 font-serif text-2xl text-ink">Candidate Agreement</h1>
        <p className="mt-2 text-sm text-muted">
          What you can expect from us, and what we expect from you, for the length of your CELTA course. Cambridge
          requires every centre to give candidates this before the course begins ({HANDBOOK}, section 6.3). It stays
          here for the whole course — you can come back to it at any time.
        </p>
        <p className="mt-2 text-sm text-muted">
          This is separate from the{" "}
          <Link href="/terms" className="text-primary hover:underline">
            platform terms
          </Link>
          , which cover your use of Connect itself.
        </p>

        <div className="mt-6 flex flex-col gap-6">
          <Section n={1} title="What we expect of you">
            <p>
              Attend every timetabled session, on time, and stay for the whole session. Submit written assignments by
              the deadlines you are given. Take part in teaching practice and feedback as scheduled, including
              observing your peers. Treat learners, tutors and other candidates with respect at all times.
            </p>
            <p>
              Tell us as early as you can if something is going to stop you meeting any of this. Almost everything can
              be worked around if we know in time, and very little can be once a deadline has passed.
            </p>
          </Section>

          <Section n={2} title="If expectations are not met">
            <p>
              We will raise it with you directly first. If it continues, you will receive a written warning setting out
              what needs to change and by when, before any sanction is applied. You will never face a sanction on this
              course without having first been told in writing what the problem is and given a chance to put it right.
            </p>
          </Section>

          <Section n={3} title="Declaring special requirements">
            <p>
              Tell us at application, or as soon as it arises, about anything affecting how you learn, teach, or are
              assessed — a disability, a specific learning difficulty, a health condition, or anything else you want us
              to take into account. Cambridge has a formal Special Requirements process and we can only apply it if we
              know in advance.
            </p>
          </Section>

          <Section n={4} title="Before the course starts">
            <p>
              You will receive the Cambridge pre-course task, which you complete in Connect. It is not graded and is
              not counted as coursework, but your tutor reads it before day one. You will also get a short tour of
              Connect to find your way around.
            </p>
            <p>Two days before the course begins we will send your group, your level, and what happens on day one.</p>
          </Section>

          <Section n={5} title="Attendance and illness">
            <p>
              CELTA is assessed continuously and attendance is a condition of it. Cambridge expects candidates to
              attend the whole course; missed teaching practice and missed feedback cannot simply be made up later,
              because both are assessed.
            </p>
            <p>
              If you are ill, tell us the same morning, not afterwards. We record absences and whether the work was
              made up, and your tutor will tell you honestly if your attendance is putting your place at risk.
            </p>
            <ToComplete>
              State the centre&apos;s own attendance threshold and the point at which absence means a candidate cannot
              complete, including how illness is treated differently from unexplained absence.
            </ToComplete>
          </Section>

          <Section n={6} title="Plagiarism">
            <p>
              Written assignments must be your own work. Quoting or drawing on a source is fine and expected — passing
              it off as yours is not. That includes work from a previous candidate, from another centre, or generated
              for you.
            </p>
            <p>
              This covers work copied from the internet, from a previous candidate, from another centre, or generated
              for you by AI. The source does not change how it is treated.
            </p>
            <p>
              Suspected plagiarism is opened as a malpractice case. You will be told exactly what has been found, shown
              the evidence, and given the chance to respond in writing before any decision is taken. Nothing is decided
              about you without you seeing it first.
            </p>
            <p>What follows a case that is upheld:</p>
            <ToCompleteList />
            <p>
              Where Cambridge&apos;s own rules require it, they are notified. That is not a discretion the centre has.
            </p>
          </Section>

          <Section n={7} title="Use of AI in coursework">
            <p>
              The rules on AI are set out in the{" "}
              <Link href="/terms" className="text-primary hover:underline">
                platform terms
              </Link>{" "}
              and form part of this agreement. In short: AI may support your thinking, but the work you submit must be
              yours, and undeclared AI-written coursework is treated as plagiarism under section 6.
            </p>
          </Section>

          <Section n={8} title="Deferrals, extensions and withdrawal">
            <p>
              If you cannot complete within the course dates, talk to us early. Deferral is possible in some
              circumstances but is not automatic and, where Cambridge&apos;s rules require it, we must consult Cambridge
              before agreeing one.
            </p>
            <p>
              You can ask to withdraw at any point through Connect. We will talk to you before it is actioned — a lot
              of people who are ready to withdraw in week two do not want to by week three.
            </p>
            <ToComplete>
              State the centre&apos;s deferral and extension policy, including any deadline and any fee consequence.
            </ToComplete>
          </Section>

          <Section n={9} title="Fees and refunds">
            <ToComplete>
              State the fee, the deposit, when the balance is due, and the refund position at each stage — before the
              course, after it starts, and on withdrawal. This is required by section 6.3 and cannot be inferred from
              anything Connect holds.
            </ToComplete>
          </Section>

          <Section n={10} title="Special consideration">
            <p>
              If something serious and unforeseen affects you during the course — serious illness, bereavement, or a
              technical failure outside your control — tell us at the time rather than afterwards. There is a process
              for taking it into account, and it works far better while the course is running.
            </p>
          </Section>

          <Section n={11} title="What you can expect from us">
            <p>
              Tutors qualified and approved by Cambridge. Written feedback on every assessed lesson. At least one
              tutorial advising you on your progress, and a minimum of two progress reports, so you will never reach
              the final week and be surprised. Clear deadlines set at the start. An end-of-course report, which
              Cambridge requires us to give every candidate.
            </p>
            <p>Your tutors are there to teach and assess you. They are not there to decide complaints about themselves — see section 12.</p>
            <ToComplete>
              Describe the facilities and resources available, on site and online, and any technological requirements
              candidates must meet themselves (hardware, software, connection, and for online delivery a quiet space to
              teach from).
            </ToComplete>
          </Section>

          <Section n={12} title="If you have a concern or a complaint">
            <p>
              Raise it with your tutor first if you can. If that is not appropriate, or it does not resolve it, you can
              raise a concern through Connect, which goes to the Main Course Tutor.
            </p>
            <p>
              If you are still not satisfied, the complaint goes to someone who is not a tutor on your course. Cambridge
              requires this ({HANDBOOK}, section 6.2): the final step of our complaints procedure is always outside the
              teaching team.
            </p>
            <ToComplete>
              Name the role the final stage goes to — for example the Director of Studies or the school principal — and
              how to contact them.
            </ToComplete>
            <p>
              Separately from all of the above, you have a right of appeal to Cambridge about an assessment decision.
              The Appeals Procedure is in your Resource Hub under Cambridge Documentation.
            </p>
          </Section>

          <Section n={13} title="Your course mode">
            <p>
              Your course is delivered face to face, online, or as a mix of the two. Which one you are on affects your
              contact hours, where your teaching practice happens, and what you need to provide yourself.
            </p>
            <ToComplete>
              State the mode this cohort is on, what it means in contact hours, and whether input is delivered
              synchronously or through a platform such as Moodle. Section 6.3 requires this to be explicit.
            </ToComplete>
          </Section>
        </div>

        <p className="mt-8 border-t border-border-faint pt-4 text-xs text-muted">
          Issued under the {HANDBOOK}, sections 6.2 and 6.3. Any section marked{" "}
          <span className="font-semibold text-ink">[Centre to complete]</span> is centre policy and must be filled in
          before this is given to candidates.
        </p>
      </div>
    </div>
  );
}
