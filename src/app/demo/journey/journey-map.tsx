// The slide. Ramy, 30 Aug 2026: "I need them to see it... and then it
// shows a slide of, like, how the information is pushed to the center and
// so on."
//
// The chains on each step say where that one step lands. This says it all
// at once, in one picture, so the shape of the thing is visible before you
// start clicking -- five lanes, one per role, and every arrow a real path
// in the app rather than an org chart.
//
// Inline SVG on purpose: it inherits the page's own theme tokens, so it
// works in both themes without a second palette, and it scales without a
// second asset to keep in sync.

interface Node {
  /** Lane index, 0 = top. */
  lane: number;
  /** Column position, 0-3, left to right along the course. */
  col: number;
  label: string;
  sub?: string;
  accent?: boolean;
}

interface Flow {
  from: [number, number];
  to: [number, number];
  label?: string;
}

const LANE_H = 78;
const COL_W = 232;
const NODE_W = 190;
const NODE_H = 46;
const LEFT = 196;   // leaves a real gutter for the lane names
const TOP = 42;

/** Where the lane names end and the diagram begins. */
const GUTTER = 86;

const cx = (col: number) => LEFT + col * COL_W;
const cy = (lane: number) => TOP + lane * LANE_H;

function JourneyDiagram({
  lanes,
  nodes,
  flows,
  columns,
  title,
}: {
  lanes: string[];
  nodes: Node[];
  flows: Flow[];
  columns: string[];
  title: string;
}) {
  const width = LEFT + columns.length * COL_W;
  const height = TOP + lanes.length * LANE_H + 8;
  const find = (lane: number, col: number) => nodes.find((n) => n.lane === lane && n.col === col);

  return (
    <figure className="m-0 flex flex-col gap-2">
      <figcaption className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{title}</figcaption>
      <div className="overflow-x-auto rounded-[6px] border border-border bg-card p-3">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={title} style={{ maxWidth: "100%", height: "auto" }}>
          <defs>
            <marker id="jm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="var(--color-muted)" />
            </marker>
          </defs>

          {columns.map((c, i) => (
            <text key={c} x={cx(i)} y={18} textAnchor="middle" fontSize="10.5" fontWeight="700" letterSpacing="0.08em" fill="var(--color-muted)">
              {c.toUpperCase()}
            </text>
          ))}

          {lanes.map((lane, i) => (
            <g key={lane}>
              <line
                x1={GUTTER}
                y1={cy(i) + NODE_H / 2}
                x2={width}
                y2={cy(i) + NODE_H / 2}
                stroke="var(--color-border-faint)"
                strokeWidth="1"
              />
              <text x={0} y={cy(i) + NODE_H / 2 + 3.5} fontSize="10.5" fontWeight="700" letterSpacing="0.06em" fill="var(--color-muted)">
                {lane.toUpperCase()}
              </text>
            </g>
          ))}

          {flows.map((f, i) => {
            const a = find(f.from[0], f.from[1]);
            const b = find(f.to[0], f.to[1]);
            if (!a || !b) return null;
            const ax = cx(a.col);
            const ay = cy(a.lane) + NODE_H / 2;
            const bx = cx(b.col);
            const by = cy(b.lane) + NODE_H / 2;
            const sameCol = a.col === b.col;
            const x1 = sameCol ? ax : ax + NODE_W / 2;
            const x2 = sameCol ? bx : bx - NODE_W / 2;
            const y1 = sameCol ? (by > ay ? ay + NODE_H / 2 : ay - NODE_H / 2) : ay;
            const y2 = sameCol ? (by > ay ? by - NODE_H / 2 : by + NODE_H / 2) : by;
            const mid = sameCol ? `${x1} ${(y1 + y2) / 2}` : `${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2}`;
            return (
              <g key={i}>
                <path
                  d={sameCol ? `M ${x1} ${y1} L ${x2} ${y2}` : `M ${x1} ${y1} C ${mid} ${x2} ${y2}`}
                  fill="none"
                  stroke="var(--color-muted)"
                  strokeWidth="1.2"
                  strokeDasharray={a.lane === b.lane ? undefined : "4 3"}
                  markerEnd="url(#jm-arrow)"
                  opacity="0.75"
                />
                {f.label ? (
                  <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 5} textAnchor="middle" fontSize="9.5" fill="var(--color-muted)">
                    {f.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {nodes.map((n) => (
            <g key={`${n.lane}-${n.col}`}>
              <rect
                x={cx(n.col) - NODE_W / 2}
                y={cy(n.lane)}
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill={n.accent ? "var(--color-primary)" : "var(--color-card-inset)"}
                stroke={n.accent ? "var(--color-primary)" : "var(--color-border)"}
                strokeWidth="1"
              />
              <text
                x={cx(n.col)}
                y={cy(n.lane) + (n.sub ? 19 : 27)}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill={n.accent ? "var(--color-primary-foreground)" : "var(--color-ink)"}
              >
                {n.label}
              </text>
              {n.sub ? (
                <text
                  x={cx(n.col)}
                  y={cy(n.lane) + 33}
                  textAnchor="middle"
                  fontSize="10"
                  fill={n.accent ? "var(--color-primary-foreground)" : "var(--color-muted)"}
                  opacity={n.accent ? 0.85 : 1}
                >
                  {n.sub}
                </text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

export function VolunteerJourneyMap() {
  return (
    <JourneyDiagram
      title="One volunteer, and everything they move"
      columns={["Signs up", "Attends", "Assignment", "End of level"]}
      lanes={["Volunteer", "Candidate", "Tutor", "Centre", "Owner"]}
      nodes={[
        { lane: 0, col: 0, label: "Signs up", sub: "L1 · answers · recording", accent: true },
        { lane: 0, col: 1, label: "In class", sub: "Zoom join marks them present" },
        { lane: 0, col: 3, label: "Certificate", sub: "design only" },
        { lane: 1, col: 1, label: "Shares handouts", sub: "off their own TP plan" },
        { lane: 1, col: 2, label: "Logs errors", sub: "one shared FOL pool", accent: true },
        { lane: 2, col: 0, label: "Transcript", sub: "on the Volunteers page" },
        { lane: 2, col: 1, label: "Register", sub: "present · partial · absent" },
        { lane: 2, col: 2, label: "Spot-check", sub: "flags empty classes" },
        { lane: 3, col: 0, label: "Volunteer pool", sub: "one person, many courses" },
        { lane: 3, col: 1, label: "Hours", sub: "toward the threshold" },
        { lane: 4, col: 1, label: "Command Center", sub: "people figures" },
      ]}
      flows={[
        { from: [0, 0], to: [2, 0], label: "transcribed" },
        { from: [0, 0], to: [3, 0] },
        { from: [0, 0], to: [1, 2], label: "L1 + recording" },
        { from: [0, 1], to: [2, 1] },
        { from: [2, 1], to: [3, 1] },
        { from: [3, 1], to: [4, 1] },
        { from: [1, 1], to: [0, 1], label: "materials" },
        { from: [1, 2], to: [2, 2] },
        { from: [3, 1], to: [0, 3], label: "hours reached" },
      ]}
    />
  );
}
