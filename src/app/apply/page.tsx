import { createAdminClient } from "@/lib/supabase/admin";
import { Wordmark } from "@/components/wordmark";
import { ApplicationForm } from "@/components/apply/application-form";

// "The intake dropdown shows real availability... the number is always the
// true one." Without this, Next.js statically prerenders the page at build
// time (confirmed via `npm run build` -- it showed up as ○ Static) and the
// availability count would only ever update on redeploy, not as applicants
// are actually accepted.
export const dynamic = "force-dynamic";

// specs/build-spec.md "Application and selection": "The application page
// is public and centre-branded... Serve it from a per-centre subdomain
// (iti.celtaconnect.com/apply)... build the routing for this early rather
// than retrofitting it." True subdomain routing is DNS-dependent and this
// app is single-tenant per deployment today (the / landing page already
// assumes one real, non-demo centre) -- so this is that one centre's
// application page at a path, not yet a subdomain. Revisit once a second
// centre is actually onboarded.
export default async function ApplyPage() {
  const admin = createAdminClient();

  const { data: center } = await admin
    .from("centers")
    .select("id, name, logo_url, application_low_availability_threshold")
    .eq("is_demo", false)
    .limit(1)
    .maybeSingle();

  if (!center) {
    return (
      <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
        <div className="frame w-full max-w-sm p-3">
        <div className="sheet-accent p-8 text-center">
          <p className="text-sm text-muted">Applications aren&apos;t open right now.</p>
        </div>
        </div>
      </div>
    );
  }

  const { data: openCourses } = await admin
    .from("courses")
    .select("id, name, start_date, end_date, delivery_mode, application_cap")
    .eq("center_id", center.id)
    .eq("accepting_applications", true)
    .order("start_date", { ascending: true });

  const courseIds = (openCourses ?? []).map((c) => c.id);
  const { data: acceptedCounts } =
    courseIds.length > 0
      ? await admin.from("applicants").select("intake_course_id").in("intake_course_id", courseIds).eq("stage", "accepted")
      : { data: [] };
  const acceptedByCoure = new Map<string, number>();
  for (const row of acceptedCounts ?? []) {
    acceptedByCoure.set(row.intake_course_id, (acceptedByCoure.get(row.intake_course_id) ?? 0) + 1);
  }

  // "The number is always the true one... no manufactured scarcity." Shown
  // as a plain count only at/below the centre's threshold; otherwise just
  // "places available", and "full -- waiting list" past the cap. Full
  // courses stay selectable (a withdrawal or deferral can free a place).
  const intakes = (openCourses ?? []).map((c) => {
    const accepted = acceptedByCoure.get(c.id) ?? 0;
    const remaining = c.application_cap != null ? c.application_cap - accepted : null;
    let availabilityLabel: string;
    if (remaining === null) {
      availabilityLabel = "places available";
    } else if (remaining <= 0) {
      availabilityLabel = "full -- waiting list";
    } else if (remaining <= center.application_low_availability_threshold) {
      availabilityLabel = `${remaining} place${remaining === 1 ? "" : "s"} left`;
    } else {
      availabilityLabel = "places available";
    }
    return {
      id: c.id,
      name: c.name,
      startDate: c.start_date,
      endDate: c.end_date,
      deliveryMode: c.delivery_mode,
      availabilityLabel,
      full: remaining !== null && remaining <= 0,
    };
  });

  const { data: prompts } = await admin
    .from("application_writing_prompts")
    .select("id, prompt_type, prompt_text")
    .eq("center_id", center.id)
    .eq("active", true)
    .order("prompt_type");

  const { data: speakingPrompts } = await admin
    .from("speaking_task_prompts")
    .select("id, prompt_text")
    .eq("center_id", center.id)
    .eq("active", true)
    .order("created_at");

  return (
    <div className="entry-ground flex min-h-screen flex-1 items-center justify-center p-8">
      <div className="frame w-full max-w-xl p-3">
      <div className="sheet-accent p-8">
        {center.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={center.logo_url} alt={center.name} className="mb-4 h-12 object-contain" />
        ) : (
          <p className="mb-1 font-serif text-lg text-ink">{center.name}</p>
        )}
        <p className="mb-4 text-sm text-muted">Apply for a Cambridge CELTA course</p>

        <ApplicationForm centerId={center.id} intakes={intakes} prompts={prompts ?? []} speakingPrompts={speakingPrompts ?? []} />

        <div className="mt-8 flex items-center justify-end gap-1.5 border-t border-border pt-4">
          <span className="text-[10px] text-muted">Powered by</span>
          <Wordmark size="header" />
        </div>
      </div>
      </div>
    </div>
  );
}
