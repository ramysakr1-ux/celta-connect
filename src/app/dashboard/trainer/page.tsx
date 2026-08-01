import { requireRole } from "@/lib/auth/require-role";

export default async function TrainerDashboardPage() {
  const profile = await requireRole("trainer");

  return (
    <div className="card p-6">
      <h1 className="font-serif text-xl text-ink">Welcome, {profile.full_name}</h1>
      <p className="mt-2 text-muted">
        Your cohort&apos;s macro TP view, observation notepad, and assignment
        review queue will live here.
      </p>
    </div>
  );
}
