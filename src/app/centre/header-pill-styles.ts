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

export const PILL_ACTIVE = `${BASE} border-primary/25 bg-primary/10 text-primary`;

// Centre Management wears garnet, Course Admin wears teal, and neither ever
// changes. Ramy, 31 Aug 2026: "the colour thing is definitely a good idea."
//
// The point is recognition before reading: the two landings are structurally
// similar -- both open on courses -- so a page-level colour tells you which
// one you are on before you have read a word. Garnet is already the
// decorative half of the teal/garnet alternation, so this spends an existing
// system rather than introducing a colour.
//
// Kept distinct from --color-destructive on purpose, which sits at a very
// similar hue: a whole view in the error colour would read as "something is
// wrong". Worth watching once it is on screen at full size.
export const PILL_ACTIVE_GARNET = `${BASE} border-garnet/30 bg-garnet/10 text-garnet`;
export const PILL_INACTIVE = `${BASE} admin-hover-fill border-border text-muted hover:border-primary hover:text-primary`;
