import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireAdmissionsHandler } from "@/lib/admissions-access";
import { createClient } from "@/lib/supabase/server";
import {
  addWritingPrompt,
  togglePromptActive,
  addSpeakingPrompt,
  toggleSpeakingPromptActive,
  addInterviewQuestion,
  toggleQuestionActive,
  toggleAdmissionsAiShadowMode,
  toggleAdmissionsAiAutobook,
} from "@/app/dashboard/admissions/actions";

const COVERAGE_AREAS = [
  "motivation_suitability",
  "language_awareness",
  "classroom_presence",
  "flexibility_openness",
  "digital_literacy",
  "time_commitment",
  "other",
] as const;
const COVERAGE_LABEL: Record<string, string> = {
  motivation_suitability: "Motivation & suitability",
  language_awareness: "Language awareness",
  classroom_presence: "Classroom presence",
  flexibility_openness: "Flexibility & openness",
  digital_literacy: "Digital literacy",
  time_commitment: "Time commitment",
  other: "Other",
};

export default async function AdmissionsSettingsPage() {
  const staff = await requireAdmissionsHandler();
  const supabase = await createClient();
  const { data: center } = await supabase
    .from("centers")
    .select("admissions_ai_shadow_mode_enabled, admissions_ai_autobook_enabled")
    // single-centre: the centre row whose interview settings this page edits
    .eq("id", staff.center_id)
    .maybeSingle();

  const [{ data: prompts }, { data: speakingPrompts }, { data: questions }] = await Promise.all([
    // single-centre: per-centre configuration; there is no editing every branch's prompts at once
    supabase.from("application_writing_prompts").select("*").eq("center_id", staff.center_id).order("prompt_type"),
    // single-centre: per-centre configuration; there is no editing every branch's prompts at once
    supabase.from("speaking_task_prompts").select("*").eq("center_id", staff.center_id).order("created_at"),
    // single-centre: per-centre configuration; there is no editing every branch's prompts at once
    supabase.from("interview_questions").select("*").eq("center_id", staff.center_id).order("coverage_area"),
  ]);

  const activeQuestions = (questions ?? []).filter((q) => q.active);
  const coveredAreas = new Set(activeQuestions.map((q) => q.coverage_area));
  const missingAreas = COVERAGE_AREAS.filter((a) => !coveredAreas.has(a));

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <BackLink href="/dashboard/admissions" label="Admissions" />
        <h1 className="mt-2 font-serif text-xl text-ink">Admissions settings</h1>
        <p className="mt-1 text-muted">
          Extended writing task prompts and the fixed interview question bank. Imported once, edited any time, carried
          into every future course.
        </p>
        {/* Email preview and delivery used to hang off the Admissions
            landing page as two more text links in a row of seven. They are
            things you check rather than daily work, so they sit here with
            the rest of what you set once. Ramy, 1 Sep 2026: six tabs was
            too many, "I'd fold Email delivery under Settings".

            Preview still lives under /dashboard/admin -- it was moved there
            before Admissions was its own room, and moving the route is a
            separate job from giving it a door. */}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border-faint pt-3">
          <Link href="/dashboard/admissions/emails" className="text-sm font-medium text-primary hover:underline">
            Email delivery &rarr;
          </Link>
          <Link href="/dashboard/admin/email-preview" className="text-sm text-muted hover:text-ink">
            Preview candidate emails
          </Link>
        </div>
      </div>

      {/* Purely decorative teal/garnet alternation down this page's stack of
          plain cards -- same treatment as the Centre Management pilot
          (src/app/centre/page.tsx). None of these carry a status of their
          own. */}
      <div className="card card-garnet flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">AI reading of the selection task</h2>
        <p className="text-sm text-muted">
          Reads the written task against the marking scheme below and sorts it into three lanes -- clear books an
          interview automatically, borderline queues for a human, clear problems flags a tutor. It never writes a
          rejection, at any confidence.{" "}
          {staff.role !== "admin" ? <span className="text-muted">Only a centre admin can change these.</span> : null}
        </p>

        <div className="flex items-center justify-between gap-3 rounded-[6px] border border-border p-3">
          <div>
            <p className="text-sm text-ink">Shadow mode</p>
            <p className="text-xs text-muted">Records a reading on every applicant. Nothing is ever sent from this alone.</p>
          </div>
          <form action={toggleAdmissionsAiShadowMode}>
            <input type="hidden" name="enabled" value={center?.admissions_ai_shadow_mode_enabled ? "false" : "true"} />
            <button
              type="submit"
              disabled={staff.role !== "admin"}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-primary disabled:opacity-50 admin-hover-fill"
            >
              {center?.admissions_ai_shadow_mode_enabled ? "On -- turn off" : "Off -- turn on"}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-[6px] border border-border p-3">
          <div>
            <p className="text-sm text-ink">Auto-book the clear lane</p>
            <p className="text-xs text-muted">
              Books an interview and sends the invitation automatically after a 15-minute hold, for readings clear on
              every criterion. Needs shadow mode on first -- turn this on once shadow-mode readings look right against
              real decisions, not before.
            </p>
          </div>
          <form action={toggleAdmissionsAiAutobook}>
            <input type="hidden" name="enabled" value={center?.admissions_ai_autobook_enabled ? "false" : "true"} />
            <button
              type="submit"
              disabled={staff.role !== "admin" || !center?.admissions_ai_shadow_mode_enabled}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-ink hover:border-primary disabled:opacity-50 admin-hover-fill"
            >
              {center?.admissions_ai_autobook_enabled ? "On -- turn off" : "Off -- turn on"}
            </button>
          </form>
        </div>
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">Extended writing task prompts</h2>
        <p className="text-sm text-muted">
          The centre defines three or four -- one narrative, one descriptive, one argumentative. The applicant picks
          one; marking criteria don&apos;t change with the prompt.
        </p>
        <ul className="flex flex-col gap-2">
          {(prompts ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border p-3 admin-hover">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{p.prompt_type}</span>
                <p className="text-sm text-ink">{p.prompt_text}</p>
              </div>
              <form action={togglePromptActive}>
                <input type="hidden" name="prompt_id" value={p.id} />
                <input type="hidden" name="active" value={String(p.active)} />
                <button type="submit" className="text-xs text-muted hover:text-ink">
                  {p.active ? "Deactivate" : "Activate"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addWritingPrompt} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="prompt_type" className="text-xs text-muted">
              Type
            </label>
            <select id="prompt_type" name="prompt_type" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink">
              <option value="narrative">Narrative</option>
              <option value="descriptive">Descriptive</option>
              <option value="argumentative">Argumentative</option>
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="prompt_text" className="text-xs text-muted">
              Prompt
            </label>
            <input id="prompt_text" name="prompt_text" type="text" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink" />
          </div>
          <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
            Add prompt
          </button>
        </form>
      </div>

      <div className="card card-garnet flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">Speaking task prompts</h2>
        <p className="text-sm text-muted">
          Short, everyday topics -- a commute, cooking something familiar, explaining something to someone. The point
          is fluency and clarity, not content difficulty. Match the writing task&apos;s count (three or four).
        </p>
        <ul className="flex flex-col gap-2">
          {(speakingPrompts ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border p-3 admin-hover">
              <p className="text-sm text-ink">{p.prompt_text}</p>
              <form action={toggleSpeakingPromptActive}>
                <input type="hidden" name="prompt_id" value={p.id} />
                <input type="hidden" name="active" value={String(p.active)} />
                <button type="submit" className="text-xs text-muted hover:text-ink">
                  {p.active ? "Deactivate" : "Activate"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addSpeakingPrompt} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="speaking_prompt_text" className="text-xs text-muted">
              Prompt
            </label>
            <input
              id="speaking_prompt_text"
              name="prompt_text"
              type="text"
              required
              className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink"
            />
          </div>
          <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
            Add prompt
          </button>
        </form>
      </div>

      <div className="card flex flex-col gap-4 p-6">
        <h2 className="font-serif text-lg text-ink">Interview question bank</h2>
        <p className="text-sm text-muted">
          Seven fixed questions is the usual shape. Two more are drawn per applicant from the weak areas their task
          reading flagged.
        </p>
        {missingAreas.length > 0 ? (
          <div className="rounded-[6px] border border-border bg-surface-muted p-3 text-sm text-ink">
            No active question covers: {missingAreas.map((a) => COVERAGE_LABEL[a]).join(", ")}.
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {(questions ?? []).map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-3 rounded-[6px] border border-border p-3 admin-hover">
              <div>
                <span className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">{COVERAGE_LABEL[q.coverage_area]}</span>
                <p className="text-sm text-ink">{q.question_text}</p>
              </div>
              <form action={toggleQuestionActive}>
                <input type="hidden" name="question_id" value={q.id} />
                <input type="hidden" name="active" value={String(q.active)} />
                <button type="submit" className="text-xs text-muted hover:text-ink">
                  {q.active ? "Deactivate" : "Activate"}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addInterviewQuestion} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="coverage_area" className="text-xs text-muted">
              Assesses
            </label>
            <select id="coverage_area" name="coverage_area" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink">
              {COVERAGE_AREAS.map((a) => (
                <option key={a} value={a}>
                  {COVERAGE_LABEL[a]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="question_text" className="text-xs text-muted">
              Question
            </label>
            <input id="question_text" name="question_text" type="text" required className="h-9 rounded-[6px] border border-input bg-card-inset px-2 text-sm text-ink" />
          </div>
          <button type="submit" className="rounded-[6px] bg-primary px-3 py-1.5 text-xs font-semibold text-card">
            Add question
          </button>
        </form>
      </div>
    </div>
  );
}
