import {
  CENTRE_ROLES,
  CENTRE_ROLE_LABELS,
  CAPABILITY_LABELS,
  grantFor,
  grantToGrantLevel,
  describeRoleCapabilities,
  type OverrideMatrix,
} from "@/lib/auth/centre-permissions";
import { cycleCapabilityOverride } from "@/app/centre/owner/actions";
import { AddCapabilityForm } from "@/app/centre/owner/add-capability-form";
import { AddRoleForm } from "@/app/centre/owner/add-role-form";

const BUILT_IN_ROLE_COLOR: Record<string, string> = {
  centre_administrator: "oklch(38% 0.072 195)",
  centre_manager: "oklch(51% 0.017 70)",
  course_administrator: "oklch(45% 0.1 68)",
  centre_owner: "oklch(42% 0.15 27)",
};
const CUSTOM_ROLE_COLOR = "oklch(45% 0.09 155)";

const LEVEL_STYLE: Record<string, React.CSSProperties | undefined> = {
  full: { background: "oklch(45% 0.09 155)", color: "white", borderColor: "oklch(45% 0.09 155)" },
  view: { background: "oklch(60% 0.11 70)", color: "white", borderColor: "oklch(60% 0.11 70)" },
  none: undefined,
};
const LEVEL_TEXT: Record<string, string> = { full: "Full", view: "View", none: "None" };

// for-claude-code-centre-owner-role-customizer.md §2: "click any pill to
// cycle Full -> View -> None." Each pill is its own tiny form rather than
// client state -- a per-centre override is a real, infrequent, deliberate
// write, and the live preview text below is generated server-side from the
// exact same grantFor() the table itself reads, so the two can never drift
// (the spec's own explicit requirement).
export function CapabilityCustomizer({
  overrides,
  customRoles,
  capabilityRows,
}: {
  overrides: OverrideMatrix;
  customRoles: { role_key: string; label: string }[];
  capabilityRows: { key: string; label: string }[];
}) {
  const roleCols = [
    ...CENTRE_ROLES.map((r) => ({ key: r as string, label: CENTRE_ROLE_LABELS[r], color: BUILT_IN_ROLE_COLOR[r] })),
    ...customRoles.map((r) => ({ key: r.role_key, label: r.label, color: CUSTOM_ROLE_COLOR })),
  ];
  // describeRoleCapabilities already knows every built-in Capability on its
  // own -- only the genuinely custom rows need passing in, or a built-in
  // label would double up in the preview text.
  const customCapabilitiesOnly = capabilityRows
    .filter((c) => !(c.key in CAPABILITY_LABELS))
    .map((c) => ({ capability_key: c.key, label: c.label }));

  return (
    <div className="owner-card flex flex-col gap-5 px-[30px] py-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="owner-serif text-[21px]">Customize what each role can do</h2>
          <p className="mt-1.5 max-w-[780px] text-[12.5px] leading-relaxed" style={{ color: "var(--owner-muted)" }}>
            Defaults are sensible out of the box -- change only what your centre runs differently. The description
            shown on the Roles tab updates automatically to match whatever you set here.
          </p>
        </div>
        <span className="owner-pill shrink-0" style={{ padding: "6px 12px", fontSize: "10.5px" }}>
          Role builder
        </span>
      </div>

      <div className="rounded-lg px-5 py-[17px]" style={{ background: "var(--owner-garnet-soft)", border: "1px solid var(--owner-line)" }}>
        <p className="owner-eyebrow mb-2.5" style={{ color: "var(--owner-garnet)" }}>
          How to use this
        </p>
        <ol className="flex flex-col gap-2.5 text-[12.5px] leading-relaxed">
          <li>
            <strong>Adjust an existing role:</strong> click any pill in the table to cycle it Full &rarr; View &rarr;
            None. Each cell is independent, so mix and match freely.
          </li>
          <li>
            <strong>Add a capability that isn&apos;t listed:</strong> type its name below, pick who should get it,
            then add it.
          </li>
          <li>
            <strong>Add a whole new role</strong> (e.g. Centre Director): type its name and add it -- it appears as a
            new column, starting at None everywhere, ready to configure the same way.
          </li>
          <li>Nothing here can ever grant course chat, grading, or candidate work -- those stay trainer-only no matter what you set.</li>
        </ol>
      </div>

      <div className="owner-card overflow-x-auto" style={{ boxShadow: "none" }}>
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="border-b px-4 py-3 text-left text-[10.5px] font-bold tracking-[0.06em] uppercase" style={{ color: "var(--owner-muted)", background: "var(--owner-parchment)", borderColor: "var(--owner-line)" }}>
                Capability
              </th>
              {roleCols.map((rc) => (
                <th key={rc.key} className="border-b px-3 py-3 text-center text-[11px] font-bold" style={{ color: rc.color, background: "var(--owner-parchment)", borderColor: "var(--owner-line)" }}>
                  {rc.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilityRows.map((cap, i) => (
              <tr key={cap.key} style={i % 2 === 1 ? { background: "color-mix(in oklab, var(--owner-garnet) 2.5%, transparent)" } : undefined}>
                <td className="border-b px-4 py-2.5" style={{ borderColor: "var(--owner-line)" }}>
                  {cap.label}
                </td>
                {roleCols.map((rc) => {
                  const level = grantToGrantLevel(grantFor([rc.key], cap.key, overrides));
                  return (
                    <td key={rc.key} className="border-b px-3 py-2.5 text-center" style={{ borderColor: "var(--owner-line)" }}>
                      <form action={cycleCapabilityOverride} className="inline">
                        <input type="hidden" name="role_key" value={rc.key} />
                        <input type="hidden" name="capability_key" value={cap.key} />
                        <input type="hidden" name="current_level" value={level} />
                        <button type="submit" className="cap-btn" style={LEVEL_STYLE[level]}>
                          {LEVEL_TEXT[level]}
                        </button>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px]" style={{ color: "var(--owner-muted)" }}>
        Click any pill to cycle Full &rarr; View &rarr; None, independently per role -- mix and match freely. Course
        chat, grading, and candidate work never appear here; no role in this family can ever hold them.
      </p>

      <AddCapabilityForm roleCols={roleCols} />

      <AddRoleForm />

      <div className="mt-1 flex flex-col gap-2.5 border-t border-dashed pt-[17px]" style={{ borderColor: "var(--owner-line)" }}>
        <p className="owner-eyebrow" style={{ color: "var(--owner-muted)" }}>
          Preview — what shows on the Roles tab
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {roleCols.map((rc) => (
            <div key={rc.key} className="rounded-lg px-4 py-[15px]" style={{ border: "1px solid var(--owner-line)", background: "var(--owner-parchment)" }}>
              <p className="mb-1.5 text-xs font-bold" style={{ color: rc.color }}>
                {rc.label}
              </p>
              <p className="text-[11.5px] leading-relaxed">{describeRoleCapabilities(rc.key, overrides, customCapabilitiesOnly)}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .cap-btn {
          font-size: 10.5px; font-weight: 700; letter-spacing: 0.01em; padding: 5px 12px; border-radius: 999px;
          border: 1px solid var(--owner-line); cursor: pointer; display: inline-block; min-width: 50px; text-align: center;
          background: var(--owner-paper); color: var(--owner-muted);
        }
        .cap-btn:hover { filter: brightness(0.97); }
      `}</style>
    </div>
  );
}
