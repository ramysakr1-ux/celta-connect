"use client";

import { useActionState } from "react";
import { logClassError, submitFolClaim, type FolFormState } from "@/lib/fol/actions";

const initialClaimState: FolFormState = { error: null, warning: null };
const inputClass = "rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-body text-ink outline-none focus:border-primary";

interface Learner {
  id: string;
  name: string;
}
interface PoolEntry {
  id: string;
  learnerName: string;
  tp_class: string;
  tp_number: number;
  problem_type: "grammar" | "pronunciation";
  note: string;
  logged_at: string;
}
interface Claim {
  id: string;
  problem_type: "grammar" | "pronunciation";
  problem_description: string;
  source: "pooled_log" | "signup_recording";
  claimed_at: string;
}

// The evidence-gathering half of Focus on the Learner -- logging (Days
// 2-9) and claiming (Day 10 on) -- rendered above the normal
// AssignmentAuthoringForm, which is still where the actual write-up goes.
// This panel doesn't replace that form, it feeds it.
export function FolPanel({
  learners,
  poolEntries,
  myClaims,
  day10Reached,
  defaultTpClass,
}: {
  learners: Learner[];
  poolEntries: PoolEntry[];
  myClaims: Claim[];
  day10Reached: boolean;
  defaultTpClass: string;
}) {
  const [claimState, claimAction, claimPending] = useActionState(submitFolClaim, initialClaimState);

  // Decorative teal/garnet alternation down this stack of plain sheets --
  // no status meaning of its own, same rule as everywhere else. Fixed
  // sequential positions (not reordered at runtime), so hardcoded per sheet
  // rather than computed from a counter.
  return (
    <div className="flex flex-col gap-4">
      <div className="sheet flex flex-col gap-3 p-6">
        <h2 className="font-serif text-h3 text-ink">Log an observation</h2>
        <p className="text-body text-muted">
          Tap a learner from the register whenever you notice a grammar or pronunciation problem, in class or out.
          Everyone&apos;s log feeds the same pool.
        </p>
        <form action={logClassError} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="learner_id" className="text-label text-muted">
              Learner
            </label>
            <select id="learner_id" name="learner_id" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-body text-ink">
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tp_class" className="text-label text-muted">
              Class
            </label>
            <input id="tp_class" name="tp_class" type="text" required defaultValue={defaultTpClass} className={`${inputClass} w-20`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tp_number" className="text-label text-muted">
              TP
            </label>
            <select id="tp_number" name="tp_number" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-body text-ink">
              {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  TP{n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="problem_type" className="text-label text-muted">
              Type
            </label>
            <select id="problem_type" name="problem_type" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-body text-ink">
              <option value="grammar">Grammar</option>
              <option value="pronunciation">Pronunciation</option>
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="note" className="text-label text-muted">
              What they said/wrote
            </label>
            <input id="note" name="note" type="text" required placeholder="e.g. 'I have seen him yesterday'" className={inputClass} />
          </div>
          <input type="hidden" name="lesson_stage" value="" />
          <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-label font-semibold text-card">
            Log it
          </button>
        </form>
      </div>

      <div className="sheet sheet-garnet flex flex-col gap-2 p-6">
        <h2 className="font-serif text-h3 text-ink">The pool -- {poolEntries.length} logged so far</h2>
        {poolEntries.length === 0 ? (
          <p className="text-body text-muted">Nothing logged yet -- yours will be the first.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {poolEntries.map((e) => (
              <li key={e.id} className="rounded-[6px] border border-border p-2 text-body">
                <span className="pill pill-neutral mr-2">{e.problem_type}</span>
                <span className="text-ink">&ldquo;{e.note}&rdquo;</span>
                <span className="ml-2 text-label text-muted">
                  -- {e.learnerName}, TP{e.tp_number} ({e.tp_class})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {day10Reached ? (
        <div className="sheet flex flex-col gap-3 p-6">
          <h2 className="font-serif text-h3 text-ink">Claim a problem</h2>
          <p className="text-body text-muted">
            Name a specific structure or sound backed by what&apos;s in the pool (or the sign-up recordings, now
            unlocked). Once claimed, it&apos;s yours -- nobody else can take the same one.
          </p>
          <form action={claimAction} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="claim_problem_type" className="text-label text-muted">
                Type
              </label>
              <select id="claim_problem_type" name="problem_type" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-body text-ink">
                <option value="grammar">Grammar</option>
                <option value="pronunciation">Pronunciation</option>
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="problem_description" className="text-label text-muted">
                Specific structure or sound
              </label>
              <input
                id="problem_description"
                name="problem_description"
                type="text"
                required
                placeholder="e.g. third conditional, or the /θ/ sound"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="source" className="text-label text-muted">
                Where from
              </label>
              <select id="source" name="source" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-body text-ink">
                <option value="pooled_log">The class log</option>
                <option value="signup_recording">Sign-up recordings</option>
              </select>
            </div>
            <button type="submit" disabled={claimPending} className="rounded-[6px] bg-primary px-3 py-1.5 text-label font-semibold text-card disabled:opacity-60">
              {claimPending ? "Checking..." : "Claim it"}
            </button>
          </form>
          {claimState.error ? <p className="text-body text-destructive">{claimState.error}</p> : null}
          {claimState.warning ? <p className="text-body text-muted">{claimState.warning}</p> : null}
        </div>
      ) : (
        <div className="sheet p-6">
          <p className="text-body text-muted">Claims open on the divergence session day.</p>
        </div>
      )}

      {myClaims.length > 0 ? (
        <div className="sheet sheet-garnet flex flex-col gap-2 p-6">
          <h2 className="font-serif text-h3 text-ink">Your claims</h2>
          <ul className="flex flex-col gap-1.5">
            {myClaims.map((c) => (
              <li key={c.id} className="text-body text-ink">
                <span className="pill pill-neutral mr-2">{c.problem_type}</span>
                {c.problem_description}
                <span className="ml-2 text-label text-muted">({c.source === "pooled_log" ? "class log" : "sign-up recording"})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
