import { setBranchVisibility } from "@/app/centre/owner/actions";

// for-claude-code-centre-owner-role-customizer.md §1: directional and
// per-pair -- "Downtown can see Riverside" is independent of "Riverside can
// see Downtown". Default blocked (migrations 0193/0194's deferred cross-
// centre visibility, resolved here as a real opt-in decision). Plain form
// submits rather than client state -- each toggle is a real write, and a
// round trip per click is the same pattern the rest of Connect uses for a
// small number of infrequent, deliberate settings changes.
export function BranchVisibilityCard({
  centerId,
  centerName,
  siblings,
  visibilityRows,
}: {
  centerId: string;
  centerName: string;
  siblings: { id: string; name: string }[];
  visibilityRows: { viewer_center_id: string; target_center_id: string; visibility: string }[];
}) {
  const visibilityOf = (viewer: string, target: string): "view_only" | "blocked" => {
    const row = visibilityRows.find((r) => r.viewer_center_id === viewer && r.target_center_id === target);
    return (row?.visibility as "view_only" | "blocked" | undefined) ?? "blocked";
  };

  const pairs: { viewer: { id: string; name: string }; target: { id: string; name: string } }[] = [];
  for (const sibling of siblings) {
    pairs.push({ viewer: { id: centerId, name: centerName }, target: sibling });
    pairs.push({ viewer: sibling, target: { id: centerId, name: centerName } });
  }

  return (
    <div className="owner-card flex flex-col gap-4 px-7 py-6">
      <div>
        <h2 className="owner-serif text-[19px]">Cross-branch visibility</h2>
        <p className="mt-1.5 max-w-[720px] text-[12.5px] leading-relaxed" style={{ color: "var(--owner-muted)" }}>
          Only you control this. Decide whether people at one branch can see what&apos;s happening at the other --
          never edit, view only.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        {pairs.map(({ viewer, target }) => {
          const current = visibilityOf(viewer.id, target.id);
          return (
            <div
              key={`${viewer.id}-${target.id}`}
              className="flex items-center justify-between rounded-lg px-[18px] py-[13px]"
              style={{ border: "1px solid var(--owner-line)", background: "var(--owner-paper)" }}
            >
              <div>
                <span className="text-[13px] font-semibold">{viewer.name}</span>
                <span className="text-xs" style={{ color: "var(--owner-muted)" }}>
                  {" "}
                  can see{" "}
                </span>
                <span className="text-[13px] font-semibold">{target.name}</span>
              </div>
              <div className="flex gap-1.5">
                {(["view_only", "blocked"] as const).map((option) => (
                  <form key={option} action={setBranchVisibility}>
                    <input type="hidden" name="viewer_center_id" value={viewer.id} />
                    <input type="hidden" name="target_center_id" value={target.id} />
                    <input type="hidden" name="visibility" value={option} />
                    <button
                      type="submit"
                      className="cap-btn"
                      style={
                        current === option
                          ? { background: option === "blocked" ? "var(--owner-garnet)" : "var(--owner-ink)", color: "white", borderColor: option === "blocked" ? "var(--owner-garnet)" : "var(--owner-ink)" }
                          : undefined
                      }
                    >
                      {option === "view_only" ? "View only" : "Blocked"}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          );
        })}
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
