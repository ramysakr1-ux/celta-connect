"use client";

import { useActionState } from "react";
import { confirmCelta5Section, type AbsenceFormState } from "@/app/portfolio/[traineeId]/status-actions";
import { BOOKLET_SECTIONS, type BookletSection } from "@/lib/celta5-booklet-content";

const initial: AbsenceFormState = { error: null };

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
          <li key={i} className="text-[13.5px] leading-[1.6] text-muted">
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
        <h4 key={i} className="mt-4 text-[13px] font-bold text-ink first:mt-0">
          {b.text}
        </h4>
      ) : (
        <p key={i} className="text-[13.5px] leading-[1.6] text-muted">
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
      <div className="mt-4 rounded-[6px] border border-border bg-card-inset px-3 py-2.5">
        <p className="text-[13px] text-ink">{text}</p>
        <p className="mt-1 text-xs text-muted">
          Signed by {signatureName} on {new Date(confirmedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[6px] border border-border bg-card-inset px-3 py-2.5">
      <p className="text-[13px] text-ink">{text}</p>
      {!canSign ? (
        <p className="mt-1 text-xs text-muted">Not yet confirmed.</p>
      ) : !viewerSignatureName ? (
        <p className="mt-1 text-xs text-muted">Set your signature name on this page before confirming.</p>
      ) : (
        <form action={formAction} className="mt-2">
          <input type="hidden" name="section" value={section} />
          {state.error ? <p className="mb-1 text-xs text-destructive">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="rounded-[6px] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
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
        <div key={section.key} id={`c5-${section.key}`} className="sheet scroll-mt-6">
          <h3 className="font-serif text-lg text-ink">{section.title}</h3>
          <div className="mt-3">
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
        </div>
      ))}
    </>
  );
}
