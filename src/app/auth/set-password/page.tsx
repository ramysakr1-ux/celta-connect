"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SetPasswordForm } from "@/app/auth/set-password/set-password-form";

// Supabase's invite email (locked to the default template until custom SMTP
// is configured) links to Supabase's own hosted verify endpoint, which on
// success redirects here with the session tokens in the URL *fragment*
// (#access_token=...) -- fragments never reach a server, so this has to be
// established client-side. @supabase/ssr's browser client auto-detects and
// consumes that fragment on construction, persisting the session via cookies
// so the server-side setPassword action can see it too. getSession() waits
// for that in-flight detection before resolving.
export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("ready");
      } else {
        router.replace("/login?error=invite_invalid");
      }
    });
  }, [router]);

  if (status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted">Confirming your invitation...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-serif text-2xl text-ink">Set your password</h1>
        <p className="mt-1 text-muted">Choose a password to finish setting up your account.</p>
        <SetPasswordForm />
      </div>
    </div>
  );
}
