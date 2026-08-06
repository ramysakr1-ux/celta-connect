import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { removeVolunteerStudent } from "@/app/trainer/(hub)/volunteers/actions";
import { AddVolunteerForm } from "@/app/trainer/(hub)/volunteers/add-volunteer-form";
import { CopyLinkButton } from "@/app/trainer/(hub)/volunteers/copy-link-button";
import { RegisterLinkButton } from "@/app/trainer/(hub)/volunteers/register-link-button";

// §14 -- the trainer-side register that mints the tokenized links volunteer
// students use to reach /student/[token] (no login, no password -- see
// migration 0030 and the auth-model note in project memory).
export default async function VolunteersPage() {
  const trainer = await requireRole(["trainer", "admin"]);

  if (!trainer.course_id) {
    return <div className="sheet text-sm text-muted">No course assigned.</div>;
  }

  const supabase = await createClient();
  const { data: volunteers } = await supabase
    .from("volunteer_students")
    .select("*")
    .eq("course_id", trainer.course_id)
    .is("removed_at", null)
    .order("name");

  const volunteerIds = (volunteers ?? []).map((v) => v.id);
  const { data: tokens } =
    volunteerIds.length > 0
      ? await supabase.from("course_access_tokens").select("token, volunteer_student_id").in("volunteer_student_id", volunteerIds)
      : { data: [] };
  const tokenByVolunteer = new Map((tokens ?? []).map((t) => [t.volunteer_student_id, t.token]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-ink">Volunteer students</h1>
          <p className="mt-1 text-sm text-muted">
            The TP students who attend teaching practice. Each gets their own no-login link to see shared materials
            and their attendance -- links expire when the course ends.
          </p>
        </div>
        <div className="shrink-0">
          <RegisterLinkButton />
        </div>
      </div>

      <AddVolunteerForm />

      <div className="sheet !p-0 overflow-hidden">
        {volunteers && volunteers.length > 0 ? (
          <ul>
            {volunteers.map((volunteer) => {
              const token = tokenByVolunteer.get(volunteer.id);
              return (
                <li key={volunteer.id} className="list-row flex items-center justify-between gap-4">
                  <p className="text-sm text-ink">{volunteer.name}</p>
                  <div className="flex items-center gap-3">
                    {token ? <CopyLinkButton token={token} /> : null}
                    <form action={removeVolunteerStudent}>
                      <input type="hidden" name="volunteer_id" value={volunteer.id} />
                      <button type="submit" className="text-xs text-destructive hover:underline">
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="p-6 text-sm text-muted">No volunteer students added yet.</p>
        )}
      </div>
    </div>
  );
}
