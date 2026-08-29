// Contents -- part of Ramy's booklet, and of the real course booklets his
// centre already runs in Google Docs ("(Click to open the section)"), not
// an invention of this app. Numbered, uppercase, jumps to the section.

const ITEMS: { n: number; label: string; href: string }[] = [
  { n: 1, label: "ROLES AND RESPONSIBILITIES OF CANDIDATES, CENTRES AND CAMBRIDGE ASSESSMENT ENGLISH", href: "#c5-roles" },
  { n: 2, label: "CANDIDATE PORTFOLIO", href: "#c5-portfolio" },
  { n: 3, label: "CAMBRIDGE ENGLISH APPEALS PROCEDURE", href: "#c5-appeals" },
  { n: 4, label: "CANDIDATE GUIDE TO ASSESSMENT", href: "#c5-assessment" },
  { n: 5, label: "RECORD OF ATTENDANCE", href: "#c5-attendance" },
  { n: 6, label: "RECORD OF OBSERVATIONS OF EXPERIENCED CLASSROOM TEACHERS (INCLUDING FILMED OBSERVATIONS)", href: "#c5-observations" },
  { n: 7, label: "RECORD OF ASSESSED TEACHING PRACTICE", href: "#c5-tp" },
  { n: 8, label: "RECORD OF ASSESSMENT OF WRITTEN ASSIGNMENTS", href: "#c5-assignments" },
  { n: 9, label: "STAGE ONE PROGRESS RECORD", href: "#c5-stage1" },
  { n: 10, label: "STAGE TWO PROGRESS RECORD", href: "#c5-stage2" },
  { n: 11, label: "STAGE THREE PROGRESS RECORD", href: "#c5-stage3" },
  { n: 12, label: "TO BE COMPLETED ON THE FINAL DAY OF THE COURSE", href: "#c5-final" },
  { n: 13, label: "APPENDIX 1 – CELTA Criteria", href: "#c5-appendix1" },
  { n: 14, label: "APPENDIX 2 – CELTA Performance Descriptors", href: "#c5-appendix2" },
];

export function BookletContents() {
  return (
    <>
      <p className="text-[10px] text-muted" style={{ marginBottom: 10 }}>
        (Click to open the section)
      </p>
      <ol className="flex flex-col gap-1.5">
        {ITEMS.map((i) => (
          <li key={i.n} className="flex gap-2 text-[11px]">
            <span className="w-5 shrink-0 text-right text-muted">{i.n}.</span>
            <a href={i.href} className="text-primary underline-offset-2 hover:underline">
              {i.label}
            </a>
          </li>
        ))}
      </ol>
    </>
  );
}
