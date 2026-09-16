import { requireAdmissionsHandler } from "@/lib/admissions-access";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBranchScope } from "@/lib/branch-scope";
import { ReferralRequestRow } from "@/app/dashboard/admissions/referral-requests/referral-request-row";
import { DEFAULT_TIMEZONE } from "@/lib/timetable-grid";
import { RoomHead } from "@/components/room-head";

// build-spec.md §14: "Where nobody spans the two, it becomes a request the
// receiving branch accepts." This is that acceptance screen -- the
// destination branch's own admins deciding what request-referral-form.tsx
// let a sibling branch send. current_center_id()'s app-side mirror
// (getCentreRoleContext) decides which branch's requests this viewer sees,
// same as everywhere else "the active branch" is asked.
export default async function ReferralRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const staff = await requireAdmissionsHandler();
  if (staff.role !== "admin") {
    return (
      <div className="card p-6 text-sm text-muted">
        Referral requests are handled by a centre admin.
      </div>
    );
  }

  // Referrals move candidates BETWEEN branches, so this page of all of them
  // should not be pinned to one: an owner holding two branches wants both
  // sides of the conversation. Already on the admin client, so this is a
  // scope change rather than a client change.
  const { branch } = await searchParams;
  const { scope } = await resolveBranchScope(staff, branch);

  const admin = createAdminClient();
  const [{ data: incoming }, { data: sent }, { data: courses }] = await Promise.all([
    admin
      .from("branch_referral_requests")
      .select("*")
      .in("to_center_id", scope)
      .order("requested_at", { ascending: false }),
    admin
      .from("branch_referral_requests")
      .select("*")
      .in("from_center_id", scope)
      .order("requested_at", { ascending: false }),
    admin.from("courses").select("id, name").in("center_id", scope).order("start_date", { ascending: false }),
  ]);

  // Branch-scoped: a person holding two branches sees both at once, so each
  // request is dated where the branch it is addressed to actually is.
  const { data: centreRows } = await admin.from("centers").select("id, time_zone").in("id", scope);
  const zoneByCentre = new Map((centreRows ?? []).map((c) => [c.id, c.time_zone ?? DEFAULT_TIMEZONE]));

  const allRequests = [...(incoming ?? []), ...(sent ?? [])];
  const applicantIds = [...new Set(allRequests.map((r) => r.applicant_id))];
  const centerIds = [...new Set(allRequests.flatMap((r) => [r.from_center_id, r.to_center_id]))];

  const [{ data: applicants }, { data: centres }] = await Promise.all([
    applicantIds.length
      ? admin.from("applicants").select("id, full_name, email").in("id", applicantIds)
      : Promise.resolve({ data: [] }),
    centerIds.length ? admin.from("centers").select("id, name").in("id", centerIds) : Promise.resolve({ data: [] }),
  ]);
  const applicantById = new Map((applicants ?? []).map((a) => [a.id, a]));
  const centerNameById = new Map((centres ?? []).map((c) => [c.id, c.name]));

  const pendingIncoming = (incoming ?? []).filter((r) => r.status === "pending");
  const decidedIncoming = (incoming ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-6">
      <RoomHead
        back={{ href: "/dashboard/admissions", label: "Admissions" }}
        eyebrow="Admissions &middot; Referral requests"
        title="Referral requests"
        lede="Candidates sibling branches are asking to refer here, and requests this branch has sent out."
      />

      {/* Plain cards: none of these carries a status of its own, and a card's
          edge inside a room carries the room's colour or nothing (centre
          side A1, 16 Sep 2026). */}
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-lg text-ink">Waiting on you ({pendingIncoming.length})</h2>
        {pendingIncoming.length === 0 ? (
          <p className="text-sm text-muted">Nothing waiting.</p>
        ) : (
          pendingIncoming.map((r, i) => (
            <ReferralRequestRow
              key={r.id}
              timeZone={zoneByCentre.get(r.to_center_id) ?? DEFAULT_TIMEZONE}
              request={{
                id: r.id,
                toCenterId: r.to_center_id,
                applicantName: applicantById.get(r.applicant_id)?.full_name ?? "Unknown candidate",
                applicantEmail: applicantById.get(r.applicant_id)?.email ?? "",
                fromCenterName: centerNameById.get(r.from_center_id) ?? "Another branch",
                requestedAt: r.requested_at,
              }}
              courses={(courses ?? []).map((c) => ({ id: c.id, name: c.name }))}
            />
          ))
        )}
      </div>

      {decidedIncoming.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-lg text-ink">Already decided</h2>
          {decidedIncoming.map((r, i) => (
            <div key={r.id} className={`card p-4 text-sm text-ink hover-ring`}>
              {applicantById.get(r.applicant_id)?.full_name ?? "Unknown candidate"} from{" "}
              {centerNameById.get(r.from_center_id) ?? "another branch"} --{" "}
              <span className={r.status === "accepted" ? "text-primary" : "text-muted"}>{r.status}</span>
            </div>
          ))}
        </div>
      ) : null}

      {(sent ?? []).length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-lg text-ink">Sent by this branch</h2>
          {(sent ?? []).map((r, i) => (
            <div key={r.id} className={`card p-4 text-sm text-ink hover-ring`}>
              {applicantById.get(r.applicant_id)?.full_name ?? "Unknown candidate"} to{" "}
              {centerNameById.get(r.to_center_id) ?? "another branch"} --{" "}
              <span className={r.status === "accepted" ? "text-primary" : r.status === "declined" ? "text-destructive" : "text-muted"}>
                {r.status}
              </span>
              {r.status === "declined" && r.decline_reason ? <span className="text-muted"> ({r.decline_reason})</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
