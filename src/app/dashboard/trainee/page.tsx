import { requireRole } from "@/lib/auth/require-role";

export default async function TraineeDashboardPage() {
  const profile = await requireRole("trainee");

  return (
    <div className="card p-6">
      <h1 className="font-serif text-xl text-ink">Welcome, {profile.full_name}</h1>
      <p className="mt-2 text-muted">
        Your TP Hub, assignments, and CELTA 5 record will live here.
      </p>
    </div>
  );
}
