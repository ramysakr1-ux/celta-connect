import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { requireAdmissionsHandler } from "@/lib/admissions-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBranchScope } from "@/lib/branch-scope";

const STATUS_LABEL: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  bounced: "Bounced",
  failed: "Failed",
};

// Same tone mapping as email-history-panel.tsx's per-applicant view, plus
// a dot -- Email Delivery.dc.html 1a wants both a coloured dot and the
// label, not just a pill.
const STATUS_TONE: Record<string, { dot: string; ink: string; weight: string }> = {
  sent: { dot: "bg-muted", ink: "text-muted", weight: "font-medium" },
  delivered: { dot: "bg-primary", ink: "text-primary", weight: "font-medium" },
  opened: { dot: "bg-primary", ink: "text-primary", weight: "font-medium" },
  bounced: { dot: "bg-destructive", ink: "text-destructive", weight: "font-bold" },
  failed: { dot: "bg-destructive", ink: "text-destructive", weight: "font-bold" },
};

function humanizeType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Email Delivery.dc.html 1a, "Delivery, not just sent" -- one course's real
// send log (applicant_emails, migration 0108/0112/0113), not a guess at
// what should have gone out. "A copy in your inbox proves it left. It
// doesn't prove it arrived." Reuses the same course-picker convention as
// pipeline/page.tsx, but lists every course (not just accepting_applications
// ones) since checking a bounce on a course that's since closed to new
// applicants is exactly when this table matters most.
export default async function EmailDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; branch?: string }>;
}) {
  const staff = await requireAdmissionsHandler();
  // Branch-aware for the same reason as the Admissions landing: RLS resolves
  // "my centre" to one centre and cannot express "every branch I hold", so the
  // read goes through the admin client and every query carries the scope.
  const { course: selectedCourseId, branch } = await searchParams;
  const { scope } = await resolveBranchScope(staff, branch);
  const supabase = createAdminClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("id, course_code, name, start_date")
    .in("center_id", scope)
    .order("start_date", { ascending: false });

  if (!courses || courses.length === 0) {
    return (
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">Email delivery</h1>
        <p className="mt-2 text-sm text-muted">No courses at your centre yet.</p>
      </div>
    );
  }

  const courseId = selectedCourseId && courses.some((c) => c.id === selectedCourseId) ? selectedCourseId : courses[0].id;
  const course = courses.find((c) => c.id === courseId)!;

  const { data: applicants } = await supabase.from("applicants").select("id").eq("intake_course_id", courseId);
  const applicantIds = (applicants ?? []).map((a) => a.id);

  const { data: emails } = applicantIds.length
    ? await supabase
        .from("applicant_emails")
        .select("id, applicant_id, recipient_name, type, status, created_at, delivered_at, bounce_reason")
        .in("applicant_id", applicantIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: bounceTasks } = await supabase
    .from("email_bounce_tasks")
    .select("id, applicant_id, email_address, reason, consecutive_bounces")
    .in("center_id", scope)
    .is("resolved_at", null)
    .in("applicant_id", applicantIds.length ? applicantIds : ["00000000-0000-0000-0000-000000000000"]);

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex items-center justify-between p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Connect · Admissions</p>
          <h1 className="mt-1 font-serif text-xl text-ink">Delivery, not just sent</h1>
          <p className="mt-1 text-sm text-muted">A copy in your inbox proves it left. It doesn&apos;t prove it arrived.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Plain GET form -- keeps this a server component like its
              siblings (pipeline/this-week), no client-side onChange needed. */}
          <form action="/dashboard/admissions/emails" method="get" className="flex items-center gap-2">
            <select
              name="course"
              defaultValue={courseId}
              className="h-9 rounded-[6px] border border-input bg-card-inset px-3 text-sm text-ink"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_code ?? c.name} {c.start_date ? `— ${c.start_date}` : ""}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 rounded-[6px] border border-border bg-card px-3 text-sm font-medium text-ink hover:border-primary admin-hover-fill"
            >
              Go
            </button>
          </form>
          <BackLink href="/dashboard/admissions" label={"Admissions"} />
        </div>
      </div>

      {(bounceTasks ?? []).length > 0 ? (
        <div className="flex flex-col gap-2">
          {(bounceTasks ?? []).map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-3 rounded-[8px] border border-destructive/25 bg-destructive/5 px-4 py-3.5 admin-hover"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
              <p className="flex-1 text-[13px] leading-relaxed text-ink">
                <strong>{b.email_address} — couldn&apos;t be delivered.</strong> &quot;{b.reason ?? "Unknown reason"}&quot;
                {b.consecutive_bounces >= 2 ? " Connect has stopped trying after two failed attempts." : ""}
              </p>
              {b.applicant_id ? (
                <Link
                  href={`/dashboard/admissions/${b.applicant_id}`}
                  className="shrink-0 text-xs font-bold text-primary hover:underline"
                >
                  Fix address
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Purely decorative teal/garnet alternation against the header card
          above -- same treatment as the Centre Management pilot
          (src/app/centre/page.tsx). Neither carries a status of its own. */}
      <div className="card card-garnet overflow-hidden !p-0">
        <div className="grid grid-cols-[1.3fr_1.1fr_1fr_1fr_1fr] border-b border-border bg-surface-muted px-4 py-2.5 text-[10.5px] font-bold tracking-[0.05em] text-muted uppercase">
          <div>To</div>
          <div>Email</div>
          <div>Sent</div>
          <div>Delivered</div>
          <div>Status</div>
        </div>
        {(emails ?? []).length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No emails sent for {course.course_code ?? course.name} yet.</p>
        ) : (
          (emails ?? []).map((email) => {
            const tone = STATUS_TONE[email.status] ?? STATUS_TONE.sent;
            return (
              <div
                key={email.id}
                className="grid grid-cols-[1.3fr_1.1fr_1fr_1fr_1fr] items-center border-b border-border-faint px-4 py-3 last:border-none admin-hover"
              >
                <div className="text-[12.5px] font-semibold text-ink">{email.recipient_name ?? "—"}</div>
                <div className="text-xs text-muted">{humanizeType(email.type)}</div>
                <div className="text-[11.5px] text-muted">{formatDate(email.created_at)}</div>
                <div className="text-[11.5px] text-muted">{formatDate(email.delivered_at)}</div>
                <div className="flex items-center gap-1.5">
                  <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} />
                  <span className={`text-xs ${tone.weight} ${tone.ink}`}>
                    {STATUS_LABEL[email.status] ?? email.status}
                    {email.status === "bounced" ? " — 2nd attempt" : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="max-w-[52rem] text-xs leading-relaxed text-muted">
        After two failed attempts to the same address, Connect stops trying and asks for a new one. Correcting it
        resends automatically — both attempts stay on the record. Nobody is BCC&apos;d on anything; this table is the
        answer BCC can&apos;t give.
      </p>
    </div>
  );
}
