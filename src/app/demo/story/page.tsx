import type { Metadata } from "next";
import { Wordmark } from "@/components/wordmark";
import { HeaderCredit } from "@/components/designer-credit";
import { StoryArrows } from "@/app/demo/story/story-arrows";
import { C, EXTRA_DOORS, GLASS, L, laneOrder, phases, type LaneKey } from "@/app/demo/story/story-data";
import { getDemoPeople } from "@/app/demo/story/demo-people";

// The Course Story: one page, the whole course, every card a door into the
// live demo as that person on that day (design_handoff_course_story, 17 Sep
// 2026 -- "the page works as-is and needs no build to present"; ported here
// so it has an address, per for-claude-code-demo-clock.md §4). It is what a
// visitor to /demo sees first now; the eight role doors are the pills in its
// header, and ?day=N on each card is the demo clock.
//
// Colour is the handoff's own: five lane colours, four cycle colours, the
// glass tile with a 3px cycle stripe. Type sits on the platform's scale, so
// the handoff's 9-40px run maps to the nearest of the nine tokens and its
// eyebrows take the two tracking values the scale allows.
//
// ?lane=<key> dims the other four lanes -- the handoff's focusLane prop, for
// presenting one person's course.
export const metadata: Metadata = { title: "The course, day by day" };

const SERIF = "var(--font-newsreader), Newsreader, Georgia, serif";
const INK = "oklch(23.5% 0.017 65)";
const MUTED = "oklch(51% 0.017 70)";
const BODY_INK = "oklch(38% 0.02 60)";
const RULE = "oklch(88% 0.016 82)";

const LANE_KEYS = new Set<string>(laneOrder);

export default async function CourseStoryPage({ searchParams }: { searchParams: Promise<{ lane?: string }> }) {
  const { lane } = await searchParams;
  const focus: LaneKey | "all" = lane && LANE_KEYS.has(lane) ? (lane as LaneKey) : "all";
  // Who each door signs you in as, read from the demo data itself.
  const people = await getDemoPeople();
  const on = (k: LaneKey) => focus === "all" || focus === k;

  return (
    <div style={{ fontFamily: "var(--font-karla), Karla, Helvetica, sans-serif", color: INK, background: "oklch(92.5% 0.012 85)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Cards navigate in this tab, not a new one (Ramy, 18 Sep 2026: "I
          click on something it opens a page and then I have to close the page
          and just go back to the demo"). The handoff opened every card in a
          new tab, which was right while there was no way back; now every demo
          shell carries the pill that returns here, so a tab per card is a tab
          to close. The lane doors in the header below still open new tabs --
          those are "go and be this person for a while", not "look at this
          screen". */}
      {/* Sticky dark header: the mark, the eyebrow, and the five lanes as doors. */}
      <div
        style={{
          background: "oklch(30% 0.042 58)",
          borderBottom: "3px solid oklch(60% 0.11 70)",
          padding: "10px 40px",
          minHeight: 56,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, whiteSpace: "nowrap" }}>
          <Wordmark size="header-compact" onDark />
          {/* The mark and the credit are identical on every screen (Ramy,
              1 Sep 2026), and this page is a landing of its own. */}
          <HeaderCredit onDark landingPath="/demo/story" />
          <div style={{ width: 1, height: 18, background: "oklch(100% 0 0 / 0.18)" }} />
          <div className="text-label font-bold tracking-[0.1em] uppercase" style={{ color: "oklch(80% 0.03 75)" }}>
            The course, day by day
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {laneOrder.map((k) => {
            const l = L[k];
            const active = on(k);
            return (
              <a
                key={k}
                href={l.demo}
                target="_blank"
                rel="noopener"
                className="wash text-label font-bold tracking-[0.1em] uppercase"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  height: 26,
                  padding: "0 10px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "oklch(98% 0.006 85)" : "oklch(100% 0 0 / 0.25)"}`,
                  background: active ? "oklch(98% 0.006 85)" : "transparent",
                  color: active ? INK : "oklch(80% 0.03 75)",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: l.colour, boxShadow: "0 0 0 1.5px oklch(100% 0 0 / 0.55)" }} />
                {l.label}
              </a>
            );
          })}
          {/* The doors that are people rather than lanes, each beside the lane
              it belongs to (story-data's EXTRA_DOORS). */}
          {EXTRA_DOORS.map((door) => {
            const active = on(door.lane);
            return (
              <a
                key={door.label}
                href={door.demo}
                target="_blank"
                rel="noopener"
                className="wash text-label font-bold tracking-[0.1em] uppercase"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  height: 26,
                  padding: "0 10px",
                  borderRadius: 999,
                  border: `1px solid ${active ? "oklch(98% 0.006 85)" : "oklch(100% 0 0 / 0.25)"}`,
                  background: active ? "oklch(98% 0.006 85)" : "transparent",
                  color: active ? INK : "oklch(80% 0.03 75)",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: L[door.lane].colour, boxShadow: "0 0 0 1.5px oklch(100% 0 0 / 0.55)" }} />
                {door.label}
              </a>
            );
          })}
        </div>
      </div>

      <StoryArrows>
        {/* Hero: the title, how to read it, the four cycles. */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 36, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="text-label font-bold tracking-[0.1em] uppercase" style={{ color: MUTED }}>
              One course · five weeks · nine roles
            </div>
            <h1 className="text-hero" style={{ margin: 0, fontFamily: SERIF, lineHeight: 1.08, fontWeight: 600, color: INK, textWrap: "balance" }}>
              Everyone works on the same course. This is what each of them does, and where it goes.
            </h1>
            <p className="text-lede" style={{ margin: 0, lineHeight: 1.6, color: BODY_INK, maxWidth: "56ch" }}>
              Time runs left to right, from the first application to the last PDF handed to the centre. Each row is one kind of
              person. Every card is a real screen, and opens the live demo as that person, on that day. Nothing here is a
              mock-up.
            </p>
            <div className="text-meta" style={{ display: "flex", flexDirection: "column", gap: 7, lineHeight: 1.5, color: BODY_INK }}>
              {[
                ["Read down a column", "to see one day as all five kinds of person lived it."],
                ["Read across a row", "to follow one person through the course."],
                ["Follow a dashed line", "to watch one piece of work pass between them."],
              ].map(([lead, rest], i) => (
                <div key={lead} style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", gap: 10, alignItems: "start" }}>
                  <span className="text-body" style={{ fontFamily: SERIF, fontWeight: 600, color: MUTED, textAlign: "right" }}>
                    {i + 1}
                  </span>
                  <span>
                    <strong style={{ fontWeight: 700 }}>{lead}</strong> {rest}
                  </span>
                </div>
              ))}
            </div>
            <div className="text-meta" style={{ color: MUTED }}>
              Every card opens the screen it names; the demo pill in that screen's header brings you back here. The demo
              centre is seeded and safe to click through.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div className="text-micro font-bold tracking-[0.12em] uppercase" style={{ color: MUTED }}>
                The four cycles
              </div>
              <div className="text-meta" style={{ lineHeight: 1.45, color: "oklch(45% 0.018 65)" }}>
                Four things repeat all course long. Each has a colour, and it is the stripe along the top of every card that
                belongs to it.
              </div>
            </div>
            {Object.values(C).map((c) => (
              <div
                key={c.title}
                style={{ display: "grid", gridTemplateColumns: "4px minmax(0,1fr)", gap: 12, padding: "10px 12px 10px 0", borderRadius: 10, background: "oklch(96.4% 0.014 85)", border: `1px solid ${RULE}` }}
              >
                <div style={{ borderRadius: 2, background: c.colour }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span className="text-lede" style={{ fontFamily: SERIF, fontWeight: 600 }}>
                      {c.title}
                    </span>
                    <span className="text-label" style={{ color: MUTED }}>
                      {c.when}
                    </span>
                  </div>
                  <div className="text-meta" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 6px", color: "oklch(30% 0.02 60)" }}>
                    {c.steps.map((t, i) => (
                      <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ padding: "2px 7px", borderRadius: 5, background: "oklch(100% 0 0 / 0.7)", border: `1px solid ${RULE}` }}>{t}</span>
                        <span style={{ color: "oklch(65% 0.02 70)", opacity: i < c.steps.length - 1 ? 1 : 0 }}>→</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Six day-grid sections: before, weeks 1-4, after. */}
        {phases.map((p) => (
          <section key={p.title} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, paddingBottom: 8, borderBottom: `2px solid ${INK}` }}>
              <div className="text-h1" style={{ fontFamily: SERIF, fontWeight: 600 }}>
                {p.title}
              </div>
              <div className="text-body" style={{ color: MUTED }}>
                {p.sub}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `150px repeat(${p.days.length}, minmax(0, 1fr))`, gap: "6px 8px", alignItems: "stretch" }}>
              <div />
              {p.days.map((d) => (
                <div key={d.label + d.eyebrow} style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 2px 6px" }}>
                  <div className="text-micro font-bold tracking-[0.12em] uppercase" style={{ color: MUTED }}>
                    {d.eyebrow}
                  </div>
                  <div className="text-body font-bold" style={{ color: INK }}>
                    {d.label}
                  </div>
                </div>
              ))}
              {laneOrder.map((k) => {
                const lane = L[k];
                const opacity = on(k) ? 1 : 0.28;
                return [
                  <div key={`${k}-head`} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 6px 0 0", borderTop: `1px solid ${RULE}`, opacity }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: lane.colour, marginTop: 3, flex: "none" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      <span className="text-label font-bold tracking-[0.1em] uppercase" style={{ color: lane.ink || lane.colour }}>
                        {lane.label}
                      </span>
                      <span className="text-micro" style={{ color: MUTED, lineHeight: 1.3 }}>
                        {lane.who}
                      </span>
                    </div>
                  </div>,
                  ...p.days.map((d) => (
                    <div key={`${k}-${d.label}-${d.eyebrow}`} style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10, borderTop: `1px solid ${RULE}`, opacity, minHeight: 24 }}>
                      {(d.cells[k] ?? []).map((n) => {
                        const cyc = n.cycle ? C[n.cycle] : null;
                        const spine = cyc ? cyc.colour : RULE;
                        const cycInk = cyc ? cyc.ink || cyc.colour : null;
                        // Three shapes of destination, in order:
                        //
                        //   "/demo/..."  a door of its own, used whole (the
                        //                public journey pages, and the one
                        //                card that opens another lane's room)
                        //   "/portfolio/{me}/tp/3"  a SCREEN: this lane's own
                        //                door, on this day, carrying ?to= so
                        //                the person lands on the screen the
                        //                card names ({me} resolves to their
                        //                own id inside the demo route)
                        //   nothing      the lane's landing page, which is
                        //                only right for cards whose subject
                        //                IS that landing page
                        const dayQ = d.day !== null ? `day=${d.day}` : "";
                        const href = !n.demo
                          ? lane.demo + (dayQ ? `?${dayQ}` : "")
                          : n.demo.startsWith("/demo/")
                            ? n.demo
                            : `${lane.demo}?${[dayQ, `to=${encodeURIComponent(n.demo)}`].filter(Boolean).join("&")}`;
                        // The name belongs to the door, so it is resolved from
                        // where the card actually goes -- including the cards
                        // with no demo of their own, which fall through to the
                        // lane's. A /demo/journey/* card has no entry: those
                        // are public screens with nobody signed in.
                        const who = people[(n.demo?.startsWith("/demo/") ? n.demo : lane.demo).split("?")[0]] ?? null;
                        return (
                          <a
                            key={n.title + n.sub}
                            href={href}
                            data-node={n.id || undefined}
                            data-to={n.to || undefined}
                            data-cyc={spine}
                            className="lift"
                            style={{
                              position: "relative",
                              zIndex: 2,
                              display: "grid",
                              gridTemplateColumns: "minmax(0,1fr)",
                              gap: 5,
                              padding: "9px 11px 9px",
                              borderRadius: 10,
                              background: GLASS[k],
                              backdropFilter: "blur(8px)",
                              border: "1px solid oklch(100% 0 0 / 0.75)",
                              borderTop: `3px solid ${spine}`,
                              boxShadow: "0 6px 18px oklch(23.5% 0.017 65 / 0.07), inset 0 1px 0 oklch(100% 0 0 / 0.8)",
                              color: "inherit",
                            }}
                          >
                            <span className="text-meta font-bold" style={{ minWidth: 0, lineHeight: 1.25, color: INK }}>
                              {n.title}
                            </span>
                            {who ? (
                              <span
                                className="text-micro"
                                style={{ display: "flex", alignItems: "center", gap: 5, lineHeight: 1.3, color: MUTED, marginTop: -2 }}
                              >
                                <span
                                  aria-hidden
                                  style={{ width: 5, height: 5, borderRadius: 999, background: lane.colour, flex: "none" }}
                                />
                                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                                  <span style={{ fontWeight: 700, color: "oklch(38% 0.02 60)" }}>{who.name}</span>
                                  {" · "}
                                  {who.role}
                                </span>
                              </span>
                            ) : null}
                            {cyc ? (
                              <span
                                className="text-micro font-bold tracking-[0.12em] uppercase"
                                style={{ justifySelf: "start", maxWidth: "100%", boxSizing: "border-box", overflowWrap: "anywhere", padding: "1px 6px", borderRadius: 999, background: cycInk ?? undefined, color: "oklch(98% 0.006 85)" }}
                              >
                                {cyc.title}
                              </span>
                            ) : null}
                            <span className="text-label" style={{ lineHeight: 1.4, color: "oklch(45% 0.018 65)" }}>
                              {n.sub}
                            </span>
                            {n.flow ? (
                              <span className="text-micro font-semibold" style={{ lineHeight: 1.35, color: cycInk ?? lane.ink ?? lane.colour }}>
                                → {n.flow}
                              </span>
                            ) : null}
                          </a>
                        );
                      })}
                    </div>
                  )),
                ];
              })}
            </div>
          </section>
        ))}

        {/* The closing band. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, paddingTop: 12, borderTop: `2px solid ${INK}` }}>
          {[
            [
              "What never happens",
              "A grade is never shown to a candidate until Cambridge confirms it. A tutor never reads a concern the candidate routed to the centre. Connect never holds money. Nobody at Connect holds a key to a centre's courses.",
            ],
            [
              "What the centre keeps",
              "Every lesson plan, self-evaluation, tutor feedback, assignment round, CELTA 5 record and letter, assembled as PDFs into the centre's own Drive at close-out. Then the course's working data is wiped. The centre owns the shell; the course owned the people.",
            ],
            [
              "Try it as anyone",
              "The pills in the header open the demo centre as each role. Same seeded course, mid-week 2, seen through nine pairs of eyes. Safe to share, safe to click.",
            ],
          ].map(([head, body]) => (
            <div key={head} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div className="text-micro font-bold tracking-[0.12em] uppercase" style={{ color: MUTED }}>
                {head}
              </div>
              <div className="text-body" style={{ lineHeight: 1.55, color: "oklch(30% 0.02 60)" }}>
                {body}
              </div>
            </div>
          ))}
        </div>
      </StoryArrows>
    </div>
  );
}
