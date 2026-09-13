import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { BackLink } from "@/components/back-link";
import { glossaryEditorFor, getCentreGlossaryRows, getGlossaryChanges } from "@/lib/centre-glossary";
import { CRITERIA_GLOSSARY, CRITERIA_LABELS_SAFE } from "@/app/criteria-glossary/glossary-data";
import { GlossaryEditorPanel } from "@/app/criteria-glossary/glossary-editor";
import { formatDateTime } from "@/lib/format-date";
import { getCachedCenter } from "@/lib/supabase/cached-queries";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";

export const dynamic = "force-dynamic";

// Ramy, 13 Sep 2026: "put the glossary behind a Centre Management screen and
// MCT as well" — then "ACT too".
//
// The glossary is the table behind the criteria auto-tagger: a tutor types
// "rapport" into a feedback point and 1d lands on it. It shipped as 64 terms
// in code with a comment saying it was meant to grow from real trainer
// phrasing. This is where it grows, and the people who may change it are the
// people who speak the shorthand — any tutor at the centre — plus the Centre
// manager.
//
// NOT under /centre: that route group's layout redirects anyone without a
// centre role, which is every tutor. The Centre management overview still
// links here, so the door is where Ramy asked for it even though the address
// is neutral.

export default async function CriteriaGlossaryPage() {
  const session = await getCurrentProfile();
  if (!session?.profile) redirect("/login");
  const profile = session.profile;

  const editor = await glossaryEditorFor(profile);
  if (!editor) redirect("/dashboard");

  const [rows, changes, centre] = await Promise.all([
    getCentreGlossaryRows(editor.centerId),
    getGlossaryChanges(editor.centerId),
    getCachedCenter(editor.centerId),
  ]);
  const zone = centre?.time_zone ?? DEFAULT_TIMEZONE;

  const centreByTerm = new Map(rows.map((r) => [r.term, r]));

  // Built-ins first, then anything the centre has added of its own.
  const builtIn = Object.entries(CRITERIA_GLOSSARY).map(([term, codes]) => {
    const own = centreByTerm.get(term);
    return {
      term,
      codes: own && own.enabled ? own.criteria_codes : codes,
      enabled: own ? own.enabled : true,
      builtIn: true,
      changed: Boolean(own),
      editorName: own?.editor_name ?? null,
      updatedAt: own?.updated_at ?? null,
    };
  });
  const ownTerms = rows
    .filter((r) => !Object.prototype.hasOwnProperty.call(CRITERIA_GLOSSARY, r.term))
    .map((r) => ({
      term: r.term,
      codes: r.criteria_codes,
      enabled: r.enabled,
      builtIn: false,
      changed: true,
      editorName: r.editor_name ?? null,
      updatedAt: r.updated_at,
    }));

  const liveCount = [...builtIn, ...ownTerms].filter((t) => t.enabled).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-6">
      <BackLink href={profile.role === "trainer" ? "/trainer" : "/centre"} label={profile.role === "trainer" ? "Today" : "Centre"} />

      <div className="sheet p-6">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          {centre?.name ?? "Your centre"} · criteria glossary
        </p>
        <h1 className="mt-1 font-serif text-2xl text-ink">The words that tag a criterion</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          When a tutor writes a feedback point, these words and phrases attach CELTA 5 codes to it automatically. Add
          your own tutors&apos; shorthand, change what a word tags, or switch one off. The manual criteria panel on the
          feedback form is unaffected either way, and a tutor can always click a code off a point.
        </p>
        <p className="mt-3 text-sm text-ink">
          {liveCount} terms are live at this centre. You are editing as <b>{editor.as}</b>, and every change here is
          recorded below with your name.
        </p>
      </div>

      <GlossaryEditorPanel
        builtIn={builtIn}
        ownTerms={ownTerms}
        criteriaLabels={CRITERIA_LABELS_SAFE}
      />

      <div className="sheet p-6">
        <h2 className="font-serif text-lg text-ink">What changed</h2>
        <p className="mt-1 text-sm text-muted">
          Tutors and the centre office both reach this screen, so every change says who made it.
        </p>
        {changes.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing has been changed yet — the glossary is as it shipped.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {changes.map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 border-b border-border-faint pb-2 text-sm last:border-b-0">
                <span className="font-medium text-ink">{c.changed_by_name ?? "Someone"}</span>
                <span className="text-muted">{verb(c.action)}</span>
                <span className="font-medium text-ink">{c.term}</span>
                {c.codes_before || c.codes_after ? (
                  <span className="text-muted">
                    {c.codes_before?.length ? c.codes_before.join(" · ") : "nothing"}
                    {" → "}
                    {c.codes_after?.length ? c.codes_after.join(" · ") : "nothing"}
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-muted">{formatDateTime(c.changed_at, zone)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function verb(action: string): string {
  if (action === "added") return "added";
  if (action === "edited") return "changed";
  if (action === "removed") return "removed";
  if (action === "disabled") return "switched off";
  return "switched back on";
}
