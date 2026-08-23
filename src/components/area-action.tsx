import Link from "next/link";
import { AREA_VERB, type AreaVerdict } from "@/lib/auth/areas";

/**
 * Renders an action according to whose job it is.
 *
 * build-spec.md §11: "Where the owner sees 'Send offer', a colleague sees
 * 'Selin handles offers', her name linking to a message. **Hiding a button
 * tells you nothing; naming the person answers the question you actually
 * have.**"
 *
 * Deliberately the opposite of the read-only role's treatment, where the
 * button is absent. A Centre observer can't act at all and doesn't need to
 * know who can; a colleague outside an area is asking exactly that question.
 *
 * The one case that renders nothing is no_capability -- their role can't do
 * this regardless of areas, so naming a holder would imply the job could pass
 * to them.
 */
export function AreaAction({
  verdict,
  children,
  adminRoomHref = "/centre",
}: {
  verdict: AreaVerdict | { kind: "no_capability" };
  /** The real control, rendered when they may act. */
  children: React.ReactNode;
  /** Where the holder's name links -- the admin room, per §12. */
  adminRoomHref?: string;
}) {
  if (verdict.kind === "no_capability") return null;
  if (verdict.kind === "act" || verdict.kind === "act_covering") {
    return (
      <div className="flex flex-col gap-1">
        {children}
        {verdict.kind === "act_covering" ? (
          <p className="text-[11px] text-muted">
            {verdict.holder.name} handles this — anything you do here will be recorded as covering.
          </p>
        ) : null}
      </div>
    );
  }

  const area = verdict.holder.area;
  return (
    <p className="text-sm text-muted">
      <Link href={adminRoomHref} className="font-medium text-primary hover:underline">
        {verdict.holder.name}
      </Link>{" "}
      handles {AREA_VERB[area]}
      {verdict.holder.endsAt ? (
        <span className="text-muted"> until {new Date(`${verdict.holder.endsAt}T00:00:00`).toLocaleDateString("en-GB")}</span>
      ) : null}
      .
    </p>
  );
}

/**
 * The attribution line that sits on a record: "Offer sent by Ramy Sakr ·
 * 14 Dec 09:12", and "Sent by Ramy Sakr, covering admissions" when the actor
 * was working outside their own area.
 *
 * §11: "Every record carries the acting user and a timestamp, **shown in
 * place**" -- not buried in a log, because the area owner must not carry
 * something someone else did.
 */
export function ActionAttribution({
  verb,
  actorName,
  at,
  coveringArea,
}: {
  verb: string;
  actorName: string;
  at: string | null;
  coveringArea?: string | null;
}) {
  if (!at) return null;
  const when = new Date(at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <p className="text-[11px] text-muted">
      {verb} by {actorName}
      {coveringArea ? `, covering ${coveringArea}` : ""} &middot; {when}
    </p>
  );
}
