import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { Stage1Form } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage1-form";
import { StageRatingsForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage-ratings-form";
import { Stage2OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage2-overall-form";
import { Stage3OverallForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/stage3-overall-form";
import { FinalGradeForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/final-grade-form";
import { AttendanceForm } from "@/app/dashboard/trainer/trainees/[id]/celta5/attendance-form";

export default async function Celta5RecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await requireRole("trainer");
  const supabase = await createClient();

  const { data: trainee } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!trainee || trainee.course_id !== trainer.course_id || trainee.role !== "trainee") {
    notFound();
  }

  const [
    { data: course },
    { data: center },
    { data: matrix },
    { data: record },
    { data: absences },
    { data: observations },
  ] = await Promise.all([
    supabase.from("courses").select("*").eq("id", trainer.course_id ?? "").maybeSingle(),
    supabase.from("centers").select("*").eq("id", trainer.center_id).maybeSingle(),
    supabase.from("celta5_matrix").select("*").eq("trainee_id", id),
    supabase.from("celta5_records").select("*").eq("trainee_id", id).maybeSingle(),
    supabase.from("attendance_absences").select("*").eq("trainee_id", id).order("session_date"),
    supabase.from("observations").select("*").eq("trainee_id", id).order("observation_date"),
  ]);

  if (!record) {
    return (
      <div className="card p-6">
        <p className="text-muted">
          No CELTA 5 record exists for this trainee yet. It&apos;s created automatically
          when they&apos;re invited -- if this trainee predates that, an admin will need
          to add it manually.
        </p>
      </div>
    );
  }

  const matrixRows = matrix ?? [];
  const matrixKey = matrixRows.map((m) => m.updated_at).join(",");

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-6">
        <h1 className="font-serif text-xl text-ink">{trainee.full_name}</h1>
        <p className="mt-1 text-muted">{trainee.email}</p>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">Center</p>
            <p className="text-ink">{center?.name ?? "--"}</p>
          </div>
          <div>
            <p className="text-muted">Course</p>
            <p className="text-ink">{course?.name ?? "--"}</p>
          </div>
          <div>
            <p className="text-muted">Dates</p>
            <p className="text-ink">
              {course ? `${course.start_date} → ${course.end_date}` : "--"}
            </p>
          </div>
        </div>
      </div>

      <AttendanceForm
        key={`attendance-${record.updated_at}`}
        record={record}
        totalHours={course?.total_hours ?? 120}
        absences={absences ?? []}
      />

      <div>
        <h2 className="font-serif text-lg text-ink">
          Observations of experienced teachers (self-reported)
        </h2>
        <div className="card mt-3 overflow-hidden">
          {observations && observations.length > 0 ? (
            <table className="table-plain w-full">
              <thead>
                <tr>
                  <th className="text-sm text-muted">Date</th>
                  <th className="text-sm text-muted">Length</th>
                  <th className="text-sm text-muted">Level</th>
                  <th className="text-sm text-muted">Focus</th>
                  <th className="text-sm text-muted">Filmed</th>
                </tr>
              </thead>
              <tbody>
                {observations.map((o) => (
                  <tr key={o.id}>
                    <td className="text-ink">{o.observation_date ?? "--"}</td>
                    <td className="text-muted">
                      {o.length_minutes ? `${o.length_minutes} min` : "--"}
                    </td>
                    <td className="text-muted">{o.level ?? "--"}</td>
                    <td className="text-muted">{o.lesson_focus ?? "--"}</td>
                    <td className="text-muted">{o.filmed ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-4 text-muted">No observations logged yet.</p>
          )}
        </div>
      </div>

      <Stage1Form key={`stage1-${record.updated_at}`} record={record} />

      <div>
        <h2 className="font-serif text-lg text-ink">Stage Two -- criteria ratings</h2>
        <div className="mt-3">
          <StageRatingsForm key={`s2-${matrixKey}`} stage={2} traineeId={id} rows={matrixRows} />
        </div>
      </div>

      <Stage2OverallForm key={`stage2-${record.updated_at}`} record={record} />

      <div>
        <h2 className="font-serif text-lg text-ink">Stage Three -- criteria ratings</h2>
        <div className="mt-3">
          <StageRatingsForm key={`s3-${matrixKey}`} stage={3} traineeId={id} rows={matrixRows} />
        </div>
      </div>

      <Stage3OverallForm key={`stage3-${record.updated_at}`} record={record} />

      <FinalGradeForm key={`final-${record.updated_at}`} record={record} />
    </div>
  );
}
