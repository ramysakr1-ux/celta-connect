import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";

// Server-side token_hash verification -- deliberately NOT the fragment-based
// client-side flow. verifyOtp() explicitly creates the session for the
// specific user the token_hash was issued to, with no dependency on (or
// risk of colliding with) whatever session the browser already had. See
// project_password_reset_session_bug memory for why the old approach broke.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  if (tokenHash && (type === "recovery" || type === "magiclink" || type === "email")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=invite_invalid");
}
