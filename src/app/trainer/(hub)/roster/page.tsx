import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAssessorCourseId } from "@/lib/auth/portfolio-access";
import { fetchRosterRows } from "@/lib/roster";
import { RosterTable } from "@/app/trainer/(hub)/roster/roster-table";
import { AddCandidateButton } from "@/app/trainer/(hub)/roster/add-candidate-button";
import { AssessorLinkButton } from "@/app/trainer/assessor-link-button";
import { toggleFilmingConsent } from "@/app/trainer/(hub)/roster/filming-consent-actions";

// The detailed operational roster. Row computation lives in lib/roster.ts,
// shared with the CSV export route below so the two can't drift on what a
// column means.
export default async function TrainerRosterPage() {
  const session = await getCurrentProfile();
  const trainer = session?.profile?.role === "trainer" || session?.profile?.role === "admin" ? session.profile : null;
  const assessorCourseId = !trainer ? await getAssessorCourseId() : null;
  if (!trainer && !assessorCourseId) redirect("/login");

  const supabase = assessorCourseId ? createAdminClient() : await createClient();

  const courseId = trainer?.course_id ?? assessorCourseId;
  if (!courseId) {
    return <div className="sheet p-6 text-sm text-muted">No course assigned.</div>;
  }

  const rows = await fetchRosterRows(supabase, courseId);
  const isMct = trainer?.tutor_role === "main_course_tutor";

  // specs/admissions-and-close-out.md §10 -- "only used if a centre films."
  // A second query rather than folding into fetchRosterRows/RosterRow:
  // every other caller of that shared function (the CSV export) has no use
  // for this, and it's centre-conditional besides.
  const { data: filmingCentre } = await supabase.from("centers").select("films_tp_sessions").eq("id", trainer?.center_id ?? "").maybeSingle();
  const filmsTpSessions = filmingCentre?.films_tp_sessions ?? false;
  const { data: consentRows } =
    filmsTpSessions && rows.length > 0
      ? await supabase
          .from("profiles")
          .select("id, filming_consent_confirmed_at")
          .in(
            "id",
            rows.map((r) => r.id)
          )
      : { data: [] };
  const consentConfirmedById = new Map((consentRows ?? []).map((r) => [r.id, !!r.filming_consent_confirmed_at]));

  // for-claude-code-fol-pooled-evidence.md, "Trainer UX / Days 2-9": "a
  // spot-check view showing per-class log counts (flagging classes with
  // ~0 entries) is useful but not required for v1." roster.ts already
  // tallies class_error_log per CANDIDATE (folEntriesLogged); this is the
  // per-CLASS view named separately in the spec -- which class isn't
  // logging, not which candidate. tp_class is free text at the point of
  // logging (fol/actions.ts), not a foreign key, so every real class name
  // comes from course_subgroups -- classes with zero log rows still need
  // to show, which a plain group-by on class_error_log alone would miss.
  const [{ data: subgroupsForFol }, { data: classErrorRows }] = await Promise.all([
    supabase.from("course_subgroups").select("name").eq("course_id", courseId),
    supabase.from("class_error_log").select("tp_class").eq("course_id", courseId),
  ]);
  const folCountByClass = new Map<string, number>();
  for (const s of subgroupsForFol ?? []) folCountByClass.set(s.name, 0);
  for (const r of classErrorRows ?? []) folCountByClass.set(r.tp_class, (folCountByClass.get(r.tp_class) ?? 0) + 1);
  const folByClass = [...folCountByClass.entries()].sort(([a], [b]) => a.localeCompare(b));

  // build-spec.md §18 -- "Visibility follows the chat rule: tutors
  // registered on that course, nobody else. No admin exception." An admin
  // scoped to this same course still sees the roster, just not the contact
  // tooling.
  const isRegisteredTutor = trainer?.role === "trainer";

  // Assessors reuse this same page (createAdminClient path) but have no
  // reason to invite anyone -- only render the join-link button for a real
  // trainer/admin session.
  let joinUrl: string | null = null;
  let courseCode = "";
  if (trainer) {
    const { data: course } = await supabase.from("courses").select("trainee_join_token, course_code, name").eq("id", courseId).maybeSingle();
    const siteUrl = process.env.SITE_URL;
    joinUrl = siteUrl && course?.trainee_join_token ? `${siteUrl}/join/${course.trainee_join_token}` : null;
    courseCode = course?.course_code || course?.name || "";
  }

  // §18 "Emailing the whole group" -- BCC only, never To/Cc, and the app
  // never renders a To-formatted address list or a copy-addresses button
  // anywhere: "if a tutor cannot paste the list into the wrong field, they
  // cannot make the mistake."
  const bccMailto = isRegisteredTutor
    ? `mailto:?bcc=${rows.map((r) => encodeURIComponent(r.email)).join(",")}&subject=${encodeURIComponent(courseCode)}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Roster</p>
          <h1 className="font-serif text-2xl text-ink">{rows.length} candidates</h1>
        </div>
        <div className="flex items-center gap-5">
          {/* for-claude-code-roster-column-crowding.md point 2: these four
              were navigation to other pages, not roster actions -- moved to
              Teaching Practice's own "More tools" row alongside the other
              drill-down links that already live there (coursebooks/
              rotation), per the nav spec's "Rotation, Portfolio and
              Announcements are not tabs -- they're reached by drilling into
              Teaching Practice." Roster's own header keeps just the four
              actions that are actually about the roster itself. */}
          <p className="text-xs text-muted">Click a row to open a portfolio</p>
          <a
            href="/trainer/roster/export"
            className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary"
          >
            Export CSV
          </a>
          {bccMailto ? (
            <a
              href={bccMailto}
              title="Outside Connect -- urgent only. Opens your mail client with every candidate BCC'd."
              className="rounded-[6px] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary"
            >
              Email all candidates
            </a>
          ) : null}
          {trainer ? <AssessorLinkButton /> : null}
          {/* The overnight session moved ViewSwitcherPill here out of the
              header; Ramy then confirmed (2026-08-16, against design-files.md
              and the remaining-screens spec) that the switcher is retired
              outright, not relocated -- "no global toggle anymore". Candidate
              preview is a per-candidate "Preview as trainee" button on the
              Portfolio screen, and the volunteers register has its own nav
              tab, so both of its live segments now have real homes. */}
          {trainer ? <AddCandidateButton courseId={courseId} joinUrl={joinUrl} /> : null}
        </div>
      </div>

      {folByClass.length > 0 ? (
        <div className="sheet flex flex-wrap items-center gap-3 p-4">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">FOL pool, by class</span>
          {folByClass.map(([name, count]) => (
            <span
              key={name}
              className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${
                count === 0 ? "border border-dashed border-status-warning-text text-status-warning-text" : "bg-accent text-ink"
              }`}
              title={count === 0 ? `${name} hasn't logged any observations yet` : `${count} observation${count === 1 ? "" : "s"} logged`}
            >
              {name} -- {count}
            </span>
          ))}
          {/* specs/for-claude-code-fol-spot-check.md -- the fuller
              grammar/pronunciation-split, last-logged, status-pill view
              this compact row doesn't have room for. */}
          <Link href="/trainer/fol-spot-check" className="text-xs font-medium text-primary hover:underline">
            Full spot-check view →
          </Link>
        </div>
      ) : null}

      {filmsTpSessions ? (
        <div className="sheet flex flex-wrap items-center gap-3 p-4">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">Filming consent</span>
          <span className="text-xs text-muted">Signed forms are on paper, kept with the class register -- this just tracks who&apos;s handed one in.</span>
          <a href="/api/filming-consent.pdf" className="text-xs font-medium text-primary hover:underline">
            Download blank form →
          </a>
          {rows.map((r) => {
            const confirmed = consentConfirmedById.get(r.id) ?? false;
            return (
              <form key={r.id} action={toggleFilmingConsent}>
                <input type="hidden" name="trainee_id" value={r.id} />
                <input type="hidden" name="confirmed" value={confirmed ? "false" : "true"} />
                <button
                  type="submit"
                  className={`rounded-[6px] px-2.5 py-1 text-xs font-medium ${
                    confirmed ? "bg-accent text-ink" : "border border-dashed border-status-warning-text text-status-warning-text"
                  }`}
                  title={confirmed ? "Click to mark as not yet collected" : "Click to mark as collected"}
                >
                  {r.name} -- {confirmed ? "Signed" : "Not yet"}
                </button>
              </form>
            );
          })}
        </div>
      ) : null}

      <RosterTable rows={rows} isMct={isMct} showContact={isRegisteredTutor} courseCode={courseCode} />
    </div>
  );
}
