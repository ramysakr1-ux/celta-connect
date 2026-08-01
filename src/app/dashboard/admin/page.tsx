import { requireRole } from "@/lib/auth/require-role";

export default async function AdminDashboardPage() {
  const profile = await requireRole("admin");

  return (
    <div className="card p-6">
      <h1 className="font-serif text-xl text-ink">Welcome, {profile.full_name}</h1>
      <p className="mt-2 text-muted">
        Center setup, roster management, and financial oversight will live
        here.
      </p>
    </div>
  );
}
