import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { SetPasswordForm } from "@/app/auth/set-password/set-password-form";

// By the time this renders, /auth/confirm has already verified the
// token_hash server-side and established the session -- no client-side
// fragment detection needed (see project_password_reset_session_bug memory
// for why the old approach was unreliable).
export default async function SetPasswordPage() {
  const session = await getCurrentProfile();
  if (!session) redirect("/login?error=session_expired");

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-serif text-2xl text-ink">Set your password</h1>
        <p className="mt-1 text-muted">Choose a new password for your account.</p>
        <SetPasswordForm />
      </div>
    </div>
  );
}
