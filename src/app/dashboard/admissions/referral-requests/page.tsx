import { BackLink } from "@/components/back-link";
import { requireAdmissionsHandler } from "@/lib/admissions-access";
import { getCentreRoleContext } from "@/lib/auth/centre-roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReferralRequestRow } from "@/app/dashboard/admissions/referral-requests/referral-request-row";

// build-spec.md §14: "Where nobody spans the two, it becomes a request the
// receiving branch accepts." This is that acceptance screen -- the
// destination branch's own admins deciding what request-referral-form.tsx
// let a sibling branch send. current_center_id()'s app-side mirror
// (getCentreRoleContext) decides which branch's requests this viewer sees,
// same as everywhere else "the active branch" is asked.
export default async function ReferralRequestsPage() {
  const staff = await requireAdmissionsHandler();
  if (staff.role !== "admin") {
    return (
      <div className="card p-6 text-sm text-muted">
        Referral requests are handled by a centre admin.
      </div>
    );
  }

  const ctx = await getCentreRoleContext(staff);
  const centerId = ctx.activeCenterId ?? staff.center_id;

  const admin = createAdminClient();
  const [{ data: incoming }, { data: sent }, { data: courses }] = await Promise.all([
    admin
      .from("branch_referral_requests")
      .select("*")
      .eq("to_center_id", centerId)
      .order("requested_at", { ascending: false }),
    admin
      .from("branch_referral_requests")
      .select("*")
      .eq("from_center_id", centerId)
      .order("requested_at", { ascending: false }),
    admin.from("courses").select("id, name").eq("center_id", centerId).order("start_date", { ascending: false }),
  ]);

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
      <div className="card p-6">
        <BackLink href="/dashboard/admissions" label="Admissions" />
        <h1 className="mt-2 font-serif text-xl text-ink">Referral requests</h1>
        <p className="mt-1 text-sm text-muted">
          Candidates sibling branches are asking to refer here, and requests this branch has sent out.
        </p>
      </div>

      {/* Purely decorative teal/garnet alternation by list position within
          each of the three lists below -- same treatment as the Centre
          Management pilot (src/app/centre/page.tsx). None of these carry a
          status of their own. */}
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-lg text-ink">Waiting on you ({pendingIncoming.length})</h2>
        {pendingIncoming.length === 0 ? (
          <p className="text-sm text-muted">Nothing waiting.</p>
        ) : (
          pendingIncoming.map((r, i) => (
            <ReferralRequestRow
              key={r.id}
              request={{
                id: r.id,
                toCenterId: r.to_center_id,
                applicantName: applicantById.get(r.applicant_id)?.full_name ?? "Unknown candidate",
                applicantEmail: applicantById.get(r.applicant_id)?.email ?? "",
                fromCenterName: centerNameById.get(r.from_center_id) ?? "Another branch",
                requestedAt: r.requested_at,
              }}
              courses={(courses ?? []).map((c) => ({ id: c.id, name: c.name }))}
              garnet={i % 2 === 1}
            />
          ))
        )}
      </div>

      {decidedIncoming.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="font-serif text-lg text-ink">Already decided</h2>
          {decidedIncoming.map((r, i) => (
            <div key={r.id} className={`card p-4 text-sm text-ink admin-hover ${i % 2 === 1 ? "card-garnet" : ""}`}>
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
            <div key={r.id} className={`card p-4 text-sm text-ink admin-hover ${i % 2 === 1 ? "card-garnet" : ""}`}>
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
