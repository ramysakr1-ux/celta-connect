"use client";

import { useActionState } from "react";
import Link from "next/link";
import { joinCourse, type JoinCourseState } from "@/app/join/[token]/actions";
import { TUTOR_ROLES, TUTOR_ROLE_LABELS } from "@/lib/tutor-roles";
import type { UserRole } from "@/lib/supabase/types";

const initialState: JoinCourseState = { error: null };

const inputClass =
  "h-10 rounded-[6px] border border-input bg-card px-3 text-sm text-ink outline-none focus:border-primary";

export function JoinForm({ token, role, isUkCentre }: { token: string; role: UserRole; isUkCentre: boolean }) {
  const [state, action, pending] = useActionState(joinCourse, initialState);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="full_name" className="text-sm text-muted">
          Full name
        </label>
        <input id="full_name" name="full_name" type="text" required className={inputClass} />
      </div>

      {role === "trainer" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tutor_role" className="text-sm text-muted">
            Your role on this course (optional)
          </label>
          <select id="tutor_role" name="tutor_role" defaultValue="" className={inputClass}>
            <option value="">Not specified</option>
            {TUTOR_ROLES.map((r) => (
              <option key={r} value={r}>
                {TUTOR_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-muted">
          Email
        </label>
        <input id="email" name="email" type="email" required className={inputClass} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm_password" className="text-sm text-muted">
          Confirm password
        </label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      {role === "trainee" && isUkCentre ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="uln" className="text-sm text-muted">
            Unique Learner Number (ULN)
          </label>
          <p className="text-xs text-muted">
            The 10-digit identifier applied to your Personal Learning Record for UK education and
            training, if you have one.
          </p>
          <input id="uln" name="uln" type="text" inputMode="numeric" maxLength={10} className={inputClass} />
        </div>
      ) : null}

      {role === "trainee" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="special_consideration" className="text-sm text-muted">
            Special consideration to declare (optional)
          </label>
          <p className="text-xs text-muted">
            A disability, learning difference, or health condition that may affect your course. Declaring it now
            means your centre can plan for it from the start, rather than partway through.
          </p>
          <textarea
            id="special_consideration"
            name="special_consideration"
            rows={2}
            className="rounded-[6px] border border-input bg-card px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
      ) : null}

      <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">
          By checking the boxes below you agree to our{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            full terms
          </Link>
          .
        </p>
        {role === "trainee" ? (
          <>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" name="agree_ip" required className="mt-0.5 accent-primary" />
              <span>
                I agree not to copy, reverse-engineer, or share access to the Connect platform,
                and to use it only for the purposes of my course.
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" name="agree_data" required className="mt-0.5 accent-primary" />
              <span>
                I understand that my coursework, tutor feedback, and records are held in
                Connect during the course and archived to the centre&apos;s secure Google Drive
                afterwards.
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" name="agree_fingerprint" required className="mt-0.5 accent-primary" />
              <span>
                I understand that Connect keeps a text fingerprint of my written assignments -- not the
                assignments themselves -- even after my course records are archived, so future candidates&apos;
                work can be checked against it.
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
                      Summarised from Cambridge&apos;s own guidance -- see your centre&apos;s uploaded disclaimer document
                      for the full, current wording.
                    </p>
                  </div>
                </details>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" name="agree_policies" required className="mt-0.5 accent-primary" />
              <span>
                I have read and agree to follow the centre&apos;s policies on attendance, plagiarism,
                complaints, and resubmission.
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" name="agree_own_work" required className="mt-0.5 accent-primary" />
              <span>Each assignment I submit is my own work, produced for this course.</span>
            </label>
          </>
        ) : (
          <>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" name="agree_confidentiality" required className="mt-0.5 accent-primary" />
              <span>I will keep candidate work, grades, and records confidential.</span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" name="agree_procedures" required className="mt-0.5 accent-primary" />
              <span>I will follow the centre&apos;s malpractice and safeguarding procedures.</span>
            </label>
            <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <input type="checkbox" name="agree_ip" required className="mt-0.5 accent-primary" />
              <span>
                I agree not to copy, reverse-engineer, or share access to the Connect platform,
                and to use it only for the purposes of my course.
              </span>
            </label>
          </>
        )}
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Joining..." : "Join course"}
      </button>
    </form>
  );
}
