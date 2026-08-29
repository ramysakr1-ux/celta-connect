"use client";

import { BOOKLET_SECTIONS, type BookletSection } from "@/lib/celta5-booklet-content";
import { ConfirmBox } from "@/app/portfolio/[traineeId]/celta5/booklet/confirm-box";
import { AssessmentTopicsTable } from "@/app/portfolio/[traineeId]/celta5/booklet/assessment-table";

// Ramy's file numbers only the last four pages -- "Section 9" through
// "Section 12", on Stage One to the final day. Everything before that
// carries a heading and no number, and the app matches that exactly
// rather than inventing numbers for pages his design leaves unnumbered.
// Ramy, 29 Aug 2026: "match my file exactly."
const SECTION_NUM: Record<string, string> = {};

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

export function BookletSections({
  portfolioConfirmedAt,
  portfolioSignatureName,
  appealsConfirmedAt,
  appealsSignatureName,
  canSign,
  fullName,
}: {
  portfolioConfirmedAt: string | null;
  portfolioSignatureName: string | null;
  appealsConfirmedAt: string | null;
  appealsSignatureName: string | null;
  canSign: boolean;
  fullName: string | null;
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
          {section.key === "assessment" ? <AssessmentTopicsTable /> : null}
          {section.confirm ? (
            <ConfirmBox
              section={section.key}
              text={section.confirm}
              confirmedAt={section.key === "portfolio" ? portfolioConfirmedAt : appealsConfirmedAt}
              signatureName={section.key === "portfolio" ? portfolioSignatureName : appealsSignatureName}
              canSign={canSign}
              fullName={fullName}
            />
          ) : null}
        </section>
      ))}
    </>
  );
}
