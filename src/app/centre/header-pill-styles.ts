// One shape for every admin section pill, shared by Centre Management's
// header and Course Admin's, so the two rows cannot drift apart.
//
// Ramy, 31 Aug 2026: "pills should sort of have the same size, should be
// next to each other. When one pill is active, the other one is inactive.
// So that the green teal is sort of jumping between them, so it's not
// confusing." And, on why it matters at all: "this is meant to be a
// platform with different views, different job descriptions... they need to
// know where they are."
//
// That is the point of this row. It is not really navigation -- it is the
// answer to "whose screen am I looking at", which on a platform where staff
// can open each other's views is a question people actually have. Teal
// marks the view you are in; the same pills, unfilled, are the other views
// you may open.
//
// The border is present in both states on purpose, so the active pill is
// exactly the size of an inactive one and nothing shifts sideways as you
// move between sections.

const BASE =
  "shrink-0 rounded-[5px] border px-2.5 py-1 text-[11px] font-bold tracking-[0.1em] uppercase transition-colors duration-150";

// Wears whichever room it is in -- garnet in Course Admin, teal in Centre
// Management -- and falls back to teal where no room colour is set, which is
// how it looked before. The colour lives in globals.css as .pill-active,
// because Tailwind cannot parse a nested var() fallback inside an arbitrary
// value and silently emits nothing.
export const PILL_ACTIVE = `${BASE} pill-active`;

export const PILL_INACTIVE = `${BASE} pill-inactive admin-hover-fill border-border text-muted hover:border-primary hover:text-primary`;
