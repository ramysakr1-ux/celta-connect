import { createAdminClient } from "@/lib/supabase/admin";
import { JoinCentreForm } from "@/app/join-centre/[token]/join-centre-form";
import { Wordmark } from "@/components/wordmark";
import { CENTRE_ROLE_LABELS, type CentreRole } from "@/lib/auth/centre-permissions";

// Invitations.dc.html 1c: "account + centre agreement, once per centre."
// Unlike the trainee/trainer /join/[token] flow this opens the centre, not
// a course -- an admin invite names no course and no dates, since many
// admins are never on a cohort at all.
export default async function JoinCentrePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("centre_admin_invites")
    .select("id, center_id, role, used_at, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite || invite.used_at || invite.revoked_at) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
        <div className="sheet-entry p-8">
          <Wordmark size="hero" />
          <p className="mt-4 text-sm text-destructive">
            This invite link is invalid or has already been used. Ask the centre owner for a new one.
          </p>
        </div>
        </div>
      </div>
    );
  }

  const { data: center } = await admin.from("centers").select("name").eq("id", invite.center_id).maybeSingle();
  const roleLabel = CENTRE_ROLE_LABELS[invite.role as CentreRole];

  return (
    <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="frame w-full max-w-sm p-3">
      <div className="sheet-entry p-8">
        <Wordmark size="hero" />
        <p className="mt-1 text-sm text-muted">
          You&apos;re joining {center?.name ?? "your centre"} as a {roleLabel}. You do not need to be on a course —
          this link opens the centre.
        </p>
        <JoinCentreForm token={token} roleLabel={roleLabel} />
      </div>
      </div>
    </div>
  );
}
