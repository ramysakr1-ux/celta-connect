"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptOffer, type AcceptOfferState } from "@/app/offer/[token]/actions";

const initialState: AcceptOfferState = { error: null };
const inputClass = "h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary";

// Same disclosures as join/[token]/join-form.tsx's trainee path, verbatim
// -- accepting an offer creates exactly the same kind of account a course
// join-link would, so it needs the same real agreements, not a lighter
// version because the entry door is different.
export function OfferAcceptForm({
  token,
  isUkCentre,
  defaultSpecialConsideration,
}: {
  token: string;
  isUkCentre: boolean;
  defaultSpecialConsideration: string | null;
}) {
  const [state, action, pending] = useActionState(acceptOffer, initialState);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-muted">
          Choose a password
        </label>
        <input id="password" name="password" type="password" required autoComplete="new-password" className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm_password" className="text-sm text-muted">
          Confirm password
        </label>
        <input id="confirm_password" name="confirm_password" type="password" required autoComplete="new-password" className={inputClass} />
      </div>

      {isUkCentre ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="uln" className="text-sm text-muted">
            Unique Learner Number (ULN)
          </label>
          <p className="text-xs text-muted">
            The 10-digit identifier applied to your Personal Learning Record for UK education and training, if you
            have one.
          </p>
          <input id="uln" name="uln" type="text" inputMode="numeric" maxLength={10} className={inputClass} />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="special_consideration" className="text-sm text-muted">
          Special consideration to declare (optional)
        </label>
        <p className="text-xs text-muted">
          Carried over from your application. A disability, learning difference, or health condition that may affect
          your course -- edit if anything&apos;s changed.
        </p>
        <textarea
          id="special_consideration"
          name="special_consideration"
          rows={2}
          defaultValue={defaultSpecialConsideration ?? ""}
          className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">
          By checking the boxes below you agree to our{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            full terms
          </Link>
          .
        </p>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_ip" required className="mt-0.5 accent-primary" />
          <span>
            I agree not to copy, reverse-engineer, or share access to the Connect platform, and to use it only for
            the purposes of my course.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_data" required className="mt-0.5 accent-primary" />
          <span>
            I understand that my coursework, tutor feedback, and records are held in Connect during the course and
            archived to the centre&apos;s secure Google Drive afterwards.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_fingerprint" required className="mt-0.5 accent-primary" />
          <span>
            I understand that Connect keeps a text fingerprint of my written assignments -- not the assignments
            themselves -- even after my course records are archived, so future candidates&apos; work can be checked
            against it.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
          <input type="checkbox" name="agree_ai_policy" required className="mt-0.5 accent-primary" />
          <span>
            I have read and understood the centre&apos;s policy on using AI in coursework.
            <details className="mt-1">
              <summary className="cursor-pointer text-ink hover:text-primary">What&apos;s permitted / not permitted</summary>
              <div className="mt-2 flex flex-col gap-2 text-ink">
                <div>
                  <p className="font-medium">Permitted</p>
                  <ul className="list-disc pl-4">
                    <li>generating ideas for teaching practice, including texts and activities</li>
                    <li>initial research for written assignments, including generating a bibliography</li>
                    <li>proofreading work</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Treated as malpractice</p>
                  <ul className="list-disc pl-4">
                    <li>generating a lesson plan, a language analysis, or a written assignment using AI</li>
                    <li>using AI for any purpose beyond those permitted</li>
                    <li>failing to acknowledge AI use, regardless of scope or purpose</li>
                  </ul>
                </div>
                <p className="text-xs">
                  Summarised from Cambridge&apos;s own guidance -- see your centre&apos;s uploaded disclaimer document for the
                  full, current wording.
                </p>
              </div>
            </details>
          </span>
        </label>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Setting up..." : "Accept and set up my account"}
      </button>
    </form>
  );
}
