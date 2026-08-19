import type { Database } from "@/lib/supabase/types";

type EmailRow = Database["public"]["Tables"]["applicant_emails"]["Row"];

const STATUS_LABEL: Record<EmailRow["status"], string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  bounced: "Bounced",
  failed: "Failed",
};

const STATUS_PILL_CLASS: Record<EmailRow["status"], string> = {
  sent: "status-pill-pending",
  delivered: "status-pill-on-track",
  opened: "status-pill-on-track",
  bounced: "status-pill-at-risk",
  failed: "status-pill-at-risk",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// All Emails.dc.html: every real send to this candidate, oldest to newest
// reversed, real delivery state from applicant_emails (migration 0108/0113,
// populated by the Resend webhook) -- not a guess at what "should" have
// sent, the actual log.
export function EmailHistoryPanel({ emails }: { emails: EmailRow[] }) {
  if (emails.length === 0) {
    return (
      <div className="card flex flex-col gap-1 p-6">
        <h2 className="font-serif text-lg text-ink">Email history</h2>
        <p className="text-sm text-muted">No emails sent yet.</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-6">
      <h2 className="font-serif text-lg text-ink">Email history</h2>
      <ul className="flex flex-col gap-2.5">
        {emails.map((email) => (
          <li key={email.id} className="flex items-start justify-between gap-3 border-b border-border-faint pb-2.5 last:border-none last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{email.subject}</p>
              <p className="text-xs text-muted">
                {formatDate(email.created_at)}
                {email.status === "bounced" && email.bounce_reason ? ` -- ${email.bounce_reason}` : ""}
                {email.status === "failed" && email.error ? ` -- ${email.error}` : ""}
              </p>
            </div>
            <span className={`status-pill shrink-0 ${STATUS_PILL_CLASS[email.status]}`}>{STATUS_LABEL[email.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
