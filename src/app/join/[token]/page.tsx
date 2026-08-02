import { createAdminClient } from "@/lib/supabase/admin";
import { JoinForm } from "@/app/join/[token]/join-form";
import type { UserRole } from "@/lib/supabase/types";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: course } = await admin
    .from("courses")
    .select("id, name, trainee_join_token, trainer_join_token")
    .or(`trainee_join_token.eq.${token},trainer_join_token.eq.${token}`)
    .maybeSingle();

  if (!course) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="card w-full max-w-sm p-8">
          <h1 className="font-serif text-2xl text-ink">Celta Connect</h1>
          <p className="mt-4 text-sm text-destructive">
            This join link is invalid or has expired. Ask your center admin for a new one.
          </p>
        </div>
      </div>
    );
  }

  const role: UserRole = course.trainee_join_token === token ? "trainee" : "trainer";

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="card w-full max-w-sm p-8">
        <h1 className="font-serif text-2xl text-ink">Celta Connect</h1>
        <p className="mt-1 text-muted">
          You&apos;re joining <span className="text-ink">{course.name}</span> as a{" "}
          <span className="text-ink capitalize">{role}</span>.
        </p>
        <JoinForm token={token} />
      </div>
    </div>
  );
}
