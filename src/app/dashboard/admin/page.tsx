import Link from "next/link";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { CreateCourseForm } from "@/app/dashboard/admin/create-course-form";

export default async function AdminDashboardPage() {
  const profile = await requireRole("admin");
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("center_id", profile.center_id)
    .order("start_date", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="card flex items-center justify-between p-6">
        <div>
          <h1 className="font-serif text-xl text-ink">Welcome, {profile.full_name}</h1>
          <p className="mt-2 text-muted">Manage your center&apos;s courses and roster.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/dashboard/admin/coursebooks" className="text-sm text-muted hover:text-ink">
            TP Points Library
          </Link>
          <Link href="/dashboard/admin/settings" className="text-sm text-muted hover:text-ink">
            Settings
          </Link>
        </div>
      </div>

      <div>
        <h2 className="font-serif text-lg text-ink">Courses</h2>
        <div className="mt-3 flex flex-col gap-2">
          {courses && courses.length > 0 ? (
            courses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/admin/courses/${course.id}`}
                className="card-interactive flex items-center justify-between p-4"
              >
                <span className="text-ink">{course.name}</span>
                <span className="text-sm text-muted">
                  {course.start_date} &rarr; {course.end_date}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-muted">No courses yet.</p>
          )}
        </div>
      </div>

      <CreateCourseForm />
    </div>
  );
}
