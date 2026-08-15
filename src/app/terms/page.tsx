import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

// The full-terms link promised by the join/offer-accept checkboxes
// ("Full terms sit behind a link" -- project_course_lifecycle_signup_
// handoff.md's front bookend). Section wording expands, verbatim in
// substance, the four checkboxes in join-form.tsx / offer-accept-form.tsx
// -- edit both places together if the agreement itself ever changes, this
// page and those checkboxes must keep saying the same thing.
export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-1 justify-center p-8">
      <div className="sheet w-full max-w-2xl p-8">
        <Link href="/" className="inline-block hover:opacity-80">
          <Wordmark size="header" />
        </Link>
        <h1 className="mt-6 font-serif text-2xl text-ink">Candidate Agreement &amp; Terms</h1>
        <p className="mt-2 text-sm text-muted">
          This is what you&apos;re agreeing to when you check the boxes on the sign-up or offer-acceptance
          page. It applies to trainees, trainers, and anyone else who creates a Connect account through a
          centre&apos;s course.
        </p>

        <div className="mt-6 flex flex-col gap-6 text-sm text-ink">
          <section>
            <h2 className="font-semibold text-ink">1. Platform use &amp; intellectual property</h2>
            <p className="mt-1.5 text-muted">
              Connect is provided to you for the sole purpose of your course. You agree not to copy,
              reverse-engineer, resell, or share access to the platform with anyone outside your course --
              including your own login details. Access is granted for the duration of your course only and
              may be withdrawn if these terms are breached.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink">2. Your data &amp; where it lives</h2>
            <p className="mt-1.5 text-muted">
              Your coursework, tutor feedback, attendance, and other course records are held in Connect
              while your course is running. At the end of the course, your centre exports a complete copy
              of your records to their own secure Google Drive as the permanent archive, and Connect&apos;s
              working copy is deleted after a short grace period. Connect is the workspace; your centre&apos;s
              Drive is the long-term record.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink">3. Assignment fingerprinting</h2>
            <p className="mt-1.5 text-muted">
              To protect the integrity of the qualification, Connect keeps a text fingerprint -- not the
              assignment itself -- of every written assignment submitted, even after your course records
              are archived and your working copy is deleted. This fingerprint is used only to check future
              candidates&apos; submissions for unoriginal work; it cannot be used to reconstruct your
              original text.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-ink">4. Use of AI in coursework</h2>
            <p className="mt-1.5 text-muted">Summarised from Cambridge&apos;s own guidance:</p>
            <div className="mt-2 flex flex-col gap-2">
              <div>
                <p className="font-medium text-ink">Permitted</p>
                <ul className="list-disc pl-5 text-muted">
                  <li>generating ideas for teaching practice, including texts and activities</li>
                  <li>initial research for written assignments, including generating a bibliography</li>
                  <li>proofreading work</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-ink">Treated as malpractice</p>
                <ul className="list-disc pl-5 text-muted">
                  <li>generating a lesson plan, a language analysis, or a written assignment using AI</li>
                  <li>using AI for any purpose beyond those permitted above</li>
                  <li>failing to acknowledge AI use, regardless of scope or purpose</li>
                </ul>
              </div>
              <p className="text-xs text-muted">
                See your centre&apos;s own uploaded AI-policy disclaimer document for the full, current
                wording -- this section summarises it, and the uploaded document takes precedence if the
                two ever differ.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-ink">Questions</h2>
            <p className="mt-1.5 text-muted">
              If anything here is unclear, ask your centre before you sign up -- these terms apply from
              the moment your account is created.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
