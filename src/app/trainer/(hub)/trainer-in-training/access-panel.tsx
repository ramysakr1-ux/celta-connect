import { grantTitAccess, revokeTitAccess } from "@/app/trainer/(hub)/trainer-in-training/actions";

// "Who can see this" -- the grant list every person on the record can
// read, and the grant/revoke controls only the MCT gets.
//
// Ramy, 4 Sep 2026: the trainer-in-training sees the list -- "Connect is
// about transparency." Revoked grants stay visible, struck, because the
// table is the log (migration 0267) and a footprint that vanishes is not
// a footprint.

export interface AccessGrantView {
  id: string;
  granteeName: string;
  grantedByName: string;
  reason: string;
  grantedAt: string;
  revokedAt: string | null;
  revokedByName: string | null;
}

function when(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function AccessPanel({
  courseTutorsId,
  tintName,
  supervisorName,
  mctNames,
  grants,
  canManage,
  grantable,
}: {
  courseTutorsId: string;
  tintName: string;
  supervisorName: string | null;
  mctNames: string[];
  grants: AccessGrantView[];
  canManage: boolean;
  /** Tutors on the course who could be granted access and do not already have it. */
  grantable: { id: string; name: string }[];
}) {
  const live = grants.filter((g) => !g.revokedAt);
  const past = grants.filter((g) => g.revokedAt);
  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-border bg-card px-[22px] py-5">
      <div className="flex flex-col gap-[3px]">
        <p className="text-[11px] font-bold tracking-[0.12em] text-muted uppercase">Who can see this</p>
        <p className="text-sm text-muted">
          Everything on this page is visible to the people below and to nobody else. The assessor sees it read-only on their visit day.
        </p>
      </div>

      <ul className="flex flex-col gap-2 text-[13px]">
        <li className="flex items-baseline justify-between gap-3 border-b border-border-faint pb-2">
          <span className="font-semibold text-ink">{tintName}</span>
          <span className="text-xs text-muted">Trainer-in-training</span>
        </li>
        <li className="flex items-baseline justify-between gap-3 border-b border-border-faint pb-2">
          <span className="font-semibold text-ink">{supervisorName ?? "No supervisor set"}</span>
          <span className="text-xs text-muted">Supervisor</span>
        </li>
        {mctNames.map((n) => (
          <li key={n} className="flex items-baseline justify-between gap-3 border-b border-border-faint pb-2">
            <span className="font-semibold text-ink">{n}</span>
            <span className="text-xs text-muted">Main course tutor</span>
          </li>
        ))}
        {live.map((g) => (
          <li key={g.id} className="flex flex-col gap-[2px] border-b border-border-faint pb-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold text-ink">{g.granteeName}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted">Granted by {g.grantedByName} · {when(g.grantedAt)}</span>
                {canManage ? (
                  <form action={revokeTitAccess}>
                    <input type="hidden" name="id" value={g.id} />
                    <button type="submit" className="rounded-[6px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-ink trainer-hover-fill">
                      Revoke
                    </button>
                  </form>
                ) : null}
              </span>
            </div>
            <span className="text-xs text-muted">{g.reason}</span>
          </li>
        ))}
        {live.length === 0 ? <li className="text-xs text-muted">Nobody else has been granted access.</li> : null}
      </ul>

      {canManage ? (
        grantable.length > 0 ? (
          <form action={grantTitAccess} className="flex flex-wrap items-end gap-2 border-t border-border-faint pt-4">
            <input type="hidden" name="course_tutors_id" value={courseTutorsId} />
            <label className="flex flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              Grant access to
              <select name="grantee_profile_id" required className="h-9 rounded-[6px] border border-border bg-card px-2 text-sm font-normal tracking-normal text-ink normal-case">
                {grantable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              Why
              <input
                name="reason"
                required
                placeholder="e.g. ACT the trainer-in-training shadows"
                className="h-9 rounded-[6px] border border-border bg-card px-2.5 text-sm font-normal tracking-normal text-ink normal-case outline-none focus:border-primary"
              />
            </label>
            <button type="submit" className="h-9 rounded-[6px] border border-border px-3 text-sm font-semibold text-ink trainer-hover-fill">
              Grant
            </button>
          </form>
        ) : (
          <p className="border-t border-border-faint pt-3 text-xs text-muted">Every other tutor on the course already has access.</p>
        )
      ) : null}

      {past.length > 0 ? (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Revoked ({past.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {past.map((g) => (
              <li key={g.id}>
                <span className="line-through">{g.granteeName}</span> · granted by {g.grantedByName} {when(g.grantedAt)} · revoked by {g.revokedByName}{" "}
                {g.revokedAt ? when(g.revokedAt) : ""} · {g.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
