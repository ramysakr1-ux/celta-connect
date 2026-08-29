"use client";

import { useActionState } from "react";
import { confirmCelta5Section, type AbsenceFormState } from "@/app/portfolio/[traineeId]/status-actions";
import { BOOKLET_SECTIONS, type BookletSection } from "@/lib/celta5-booklet-content";

const initial: AbsenceFormState = { error: null };

// Cambridge's own section numbers, so these read as pages 1-4 of the
// booklet rather than as four loose cards.
const SECTION_NUM: Record<string, string> = {
  roles: "Section 1",
  portfolio: "Section 2",
  appeals: "Section 3",
  assessment: "Section 4",
};

// Ramy, 30 Aug 2026: "I wanted them to read everything in there." The real
// CELTA 5's static sections -- portfolio requirements, the Cambridge
// appeals procedure, the guide to assessment -- rendered in full, in
// Cambridge's own order, with each section's confirmation where Cambridge
// puts it: at the end of the text it refers to.
//
// Not collapsed behind anything. A confirmation attached to text a
// candidate had to expand to see is a weaker claim than one attached to
// text that was simply there.

function Blocks({ section }: { section: BookletSection }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = (k: number) => {
    if (!list.length) return;
    out.push(
      <ul key={`ul-${k}`} className="ml-4 list-disc space-y-1">
        {list.map((t, i) => (
          <li key={i} className="text-[10.5px] leading-[1.6] text-muted">
            {t}
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  section.blocks.forEach((b, i) => {
    if (b.kind === "li") {
      list.push(b.text);
      return;
    }
    flush(i);
    out.push(
      b.kind === "h" ? (
        <h4 key={i} className="mt-4 text-[11px] font-bold text-ink first:mt-0">
          {b.text}
        </h4>
      ) : (
        <p key={i} className="text-[10.5px] leading-[1.6] text-muted">
          {b.text}
        </p>
      )
    );
  });
  flush(section.blocks.length);
  return <div className="flex flex-col gap-2">{out}</div>;
}

function Confirmation({
  section,
  text,
  confirmedAt,
  signatureName,
  canSign,
  viewerSignatureName,
}: {
  section: string;
  text: string;
  confirmedAt: string | null;
  signatureName: string | null;
  canSign: boolean;
  viewerSignatureName: string | null;
}) {
  const [state, formAction, pending] = useActionState(confirmCelta5Section, initial);

  if (confirmedAt) {
    return (
      <div className="c5-box" style={{ marginTop: 16 }}>
        <p className="text-[11px] leading-relaxed text-ink">{text}</p>
        <p className="mt-1 text-[10px] text-muted">
          Signed by {signatureName} on {new Date(confirmedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
      </div>
    );
  }

  return (
    <div className="c5-box" style={{ marginTop: 16 }}>
      <p className="text-[11px] leading-relaxed text-ink">{text}</p>
      {!canSign ? (
        <p className="mt-1 text-[10px] text-muted">Not yet confirmed.</p>
      ) : !viewerSignatureName ? (
        <p className="mt-1 text-[10px] text-muted">Set your signature name on this page before confirming.</p>
      ) : (
        <form action={formAction} className="mt-2">
          <input type="hidden" name="section" value={section} />
          {state.error ? <p className="mb-1 text-[10px] text-destructive">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="c5-btn"
          >
            {pending ? "Saving…" : `Confirm as ${viewerSignatureName}`}
          </button>
        </form>
      )}
    </div>
  );
}

export function BookletSections({
  portfolioConfirmedAt,
  portfolioSignatureName,
  appealsConfirmedAt,
  appealsSignatureName,
  canSign,
  viewerSignatureName,
}: {
  portfolioConfirmedAt: string | null;
  portfolioSignatureName: string | null;
  appealsConfirmedAt: string | null;
  appealsSignatureName: string | null;
  canSign: boolean;
  viewerSignatureName: string | null;
}) {
  return (
    <>
      {BOOKLET_SECTIONS.map((section) => (
        <section key={section.key} id={`c5-${section.key}`} className="c5-break scroll-mt-6">
          <div className="c5-section-num">{SECTION_NUM[section.key] ?? ""}</div>
          <h2 className="c5-section-header">{section.title}</h2>
          <div>
            <Blocks section={section} />
          </div>
          {section.confirm ? (
            <Confirmation
              section={section.key}
              text={section.confirm}
              confirmedAt={section.key === "portfolio" ? portfolioConfirmedAt : appealsConfirmedAt}
              signatureName={section.key === "portfolio" ? portfolioSignatureName : appealsSignatureName}
              canSign={canSign}
              viewerSignatureName={viewerSignatureName}
            />
          ) : null}
        </section>
      ))}
    </>
  );
}
