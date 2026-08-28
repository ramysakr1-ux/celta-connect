import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ASSIGNMENT_INFO } from "@/lib/assignment-info";
import {
  ensureTitRecord,
  computeHeadlineStats,
  TIT_PRE_COURSE_TASKS,
  HEADLINE_MIN_PCT,
  INPUT_ASYNC_MAX_PCT,
  MIN_DELIVERED_SESSIONS,
  TASK12_STAGE1_REQUIRED,
  CANDIDATES_TO_FOLLOW,
} from "@/lib/trainer-in-training";
import {
  PreCourseChecklist,
  SchemeAndModesForm,
  ObservedSessionRow,
  Task12Stage1Form,
  Task12Stage1List,
  AddDeliveredSessionForm,
  DeliveredSessionCard,
  AddFeedbackSessionForm,
  FeedbackSessionCard,
  AddCandidateFollowedForm,
  CandidateFollowedCard,
  AddShadowMarkingForm,
  ShadowMarkingList,
  TaskRecordItemRow,
  ReflectiveEssayForm,
  AssessorDayCard,
  OutcomeForm,
  SubmitPortfolioButton,
} from "@/app/trainer/(hub)/trainer-in-training/sections";

interface CourseTutorRow {
  id: string;
  course_id: string;
  profile_id: string;
  verified_at: string | null;
  supervisor_profile_id: string | null;
}

// specs/for-claude-code-trainer-in-training.md's Screens 1a-1d, one course
// tutor's whole workspace. "Verification must precede training... the app
// should refuse to open a TinT record with no verification date" -- so the
// gate below is the first thing checked, before any of the tables that
// follow are even created.
export async function TitWorkspace({
  supabase,
  courseTutor,
}: {
  supabase: SupabaseClient<Database>;
  courseTutor: CourseTutorRow;
}) {
  const [{ data: tutorProfile }, { data: supervisorProfile }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", courseTutor.profile_id).maybeSingle(),
    courseTutor.supervisor_profile_id
      ? supabase.from("profiles").select("full_name").eq("id", courseTutor.supervisor_profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!courseTutor.verified_at) {
    return (
      <div className="sheet">
        <h2 className="font-serif text-lg text-ink">{tutorProfile?.full_name ?? "Trainer-in-training"}</h2>
        <p className="mt-2 text-sm text-destructive">
          No Cambridge verification date is on file yet -- training done without prior verification is never
          acknowledged, so this workspace stays closed until one is set on the Tutors panel in Centre settings.
        </p>
      </div>
    );
  }

  const titRecordId = await ensureTitRecord(supabase, courseTutor.id);
  if (!titRecordId) {
    return (
      <div className="sheet">
        <p className="text-sm text-destructive">Could not open this workspace. Try refreshing.</p>
      </div>
    );
  }

  const [
    { data: titRecord },
    { data: preCourseTasks },
    { data: timetableEvents },
    { data: observedSessions },
    { data: task12Stage1 },
    { data: deliveredSessions },
    { data: feedbackSessions },
    { data: candidatesFollowed },
    { data: shadowMarking },
    { data: taskRecordItems },
    { data: courseTrainees },
    { data: courseAssignments },
  ] = await Promise.all([
    supabase.from("tit_records").select("*").eq("id", titRecordId).single(),
    supabase.from("tit_pre_course_tasks").select("*").eq("tit_record_id", titRecordId),
    supabase
      .from("course_timetable_events")
      .select("id, title, event_date, type")
      .eq("course_id", courseTutor.course_id)
      .in("type", ["input_session", "tp"])
      .order("event_date"),
    supabase.from("tit_observed_sessions").select("*").eq("tit_record_id", titRecordId),
    supabase.from("tit_task12_stage1").select("*").eq("tit_record_id", titRecordId).order("filed_at", { ascending: false }),
    supabase.from("tit_delivered_sessions").select("*").eq("tit_record_id", titRecordId).order("delivered_at", { ascending: false }),
    supabase.from("tit_feedback_sessions").select("*").eq("tit_record_id", titRecordId).order("conducted_at", { ascending: false }),
    supabase.from("tit_candidates_followed").select("*").eq("tit_record_id", titRecordId),
    supabase.from("tit_shadow_marking").select("*").eq("tit_record_id", titRecordId).order("marked_at", { ascending: false }),
    supabase.from("tit_task_record_items").select("*").eq("tit_record_id", titRecordId).order("item_number"),
    supabase.from("profiles").select("id, full_name").eq("course_id", courseTutor.course_id).eq("role", "trainee"),
    supabase.from("assignments").select("id, trainee_id, assignment_type").eq("course_id", courseTutor.course_id),
  ]);

  if (!titRecord) return null;

  const observedEventIds = new Set((observedSessions ?? []).map((o) => o.timetable_event_id));
  const observedByEventId = new Map((observedSessions ?? []).map((o) => [o.timetable_event_id, o]));
  const stats = computeHeadlineStats(timetableEvents ?? [], observedSessions ?? []);

  const traineeNameById = new Map((courseTrainees ?? []).map((t) => [t.id, t.full_name]));
  const eventTitleById = new Map((timetableEvents ?? []).map((e) => [e.id, e.title]));
  const assignmentLabelById = new Map(
    (courseAssignments ?? []).map((a) => [a.id, `${traineeNameById.get(a.trainee_id) ?? "Unknown"} -- ${ASSIGNMENT_INFO[a.assignment_type]?.title ?? a.assignment_type}`])
  );

  const inputEvents = (timetableEvents ?? []).filter((e) => e.type === "input_session");
  const tpEvents = (timetableEvents ?? []).filter((e) => e.type === "tp");

  // Ramy, 28 Aug 2026: spec line 51 -- External always requires it;
  // Internal requires it too when the TinT doesn't train at their own
  // nominating centre. Was scheme === "external" only.
  const requiresAssessorDay = titRecord.scheme === "external" || !titRecord.trains_at_nominating_centre;

  return (
    <div className="sheet flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Trainer-in-Training</p>
          <h2 className="font-serif text-xl text-ink">{tutorProfile?.full_name ?? "Unknown"}</h2>
          <p className="mt-1 text-sm text-muted">
            {titRecord.scheme === "external" ? "External scheme" : "Internal scheme"} · verified{" "}
            {new Date(courseTutor.verified_at).toLocaleDateString("en-GB")}
            {supervisorProfile ? ` · supervised by ${supervisorProfile.full_name}` : " · no supervisor set"}
          </p>
        </div>
        <SubmitPortfolioButton titRecordId={titRecord.id} submittedAt={titRecord.portfolio_submitted_at} />
      </div>

      <SchemeAndModesForm
        titRecordId={titRecord.id}
        scheme={titRecord.scheme}
        modesTrained={titRecord.modes_trained}
        trainsAtNominatingCentre={titRecord.trains_at_nominating_centre}
      />

      {/* Headline stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Input observed"
          pct={stats.inputObservedPct}
          detail={`${stats.inputObservedCount} of ${stats.inputTotalCount} · ${stats.inputAsyncPct}% async`}
          warning={
            stats.inputAsyncPct > INPUT_ASYNC_MAX_PCT
              ? `Over the ${INPUT_ASYNC_MAX_PCT}% asynchronous ceiling (${stats.inputAsyncCount} of ${stats.inputObservedCount} observed sessions)`
              : null
          }
        />
        <StatCard label="TP / feedback observed" pct={stats.tpObservedPct} detail={`${stats.tpObservedCount} of ${stats.tpTotalCount}`} />
        <div className="rounded-[6px] border border-border p-3">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Sessions delivered</p>
          <p className="mt-1 font-serif text-2xl text-ink">
            {(deliveredSessions ?? []).length} <span className="text-sm text-muted">/ {MIN_DELIVERED_SESSIONS} min</span>
          </p>
        </div>
      </div>

      {/* Pre-course tasks */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Pre-course tasks</h3>
        <div className="mt-2">
          <PreCourseChecklist
            tasks={(preCourseTasks ?? []).map((t) => ({
              id: t.id,
              label: TIT_PRE_COURSE_TASKS.find((d) => d.key === t.task_key)?.label ?? t.task_key,
              completedAt: t.completed_at,
            }))}
          />
        </div>
      </section>

      {/* Observed sessions */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Input sessions observed (min {HEADLINE_MIN_PCT}%)</h3>
        <div className="mt-2 divide-y divide-border-faint">
          {inputEvents.length === 0 ? (
            <p className="text-sm text-muted">No input sessions on the timetable yet.</p>
          ) : (
            inputEvents.map((e) => {
              const obs = observedByEventId.get(e.id);
              return (
                <ObservedSessionRow
                  key={e.id}
                  titRecordId={titRecord.id}
                  event={e}
                  observedId={obs?.id ?? null}
                  asynchronous={obs?.asynchronous ?? false}
                  showAsync
                />
              );
            })
          )}
        </div>

        <h3 className="mt-4 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">TP and feedback observed (min {HEADLINE_MIN_PCT}%, never asynchronous)</h3>
        <div className="mt-2 divide-y divide-border-faint">
          {tpEvents.length === 0 ? (
            <p className="text-sm text-muted">No TP on the timetable yet.</p>
          ) : (
            tpEvents.map((e) => {
              const obs = observedByEventId.get(e.id);
              return (
                <ObservedSessionRow
                  key={e.id}
                  titRecordId={titRecord.id}
                  event={e}
                  observedId={obs?.id ?? null}
                  asynchronous={false}
                  showAsync={false}
                />
              );
            })
          )}
        </div>
      </section>

      {/* Task Twelve */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          Task Twelve, Stage 1 -- pre-session handouts ({(task12Stage1 ?? []).length} of {TASK12_STAGE1_REQUIRED})
        </h3>
        <p className="mt-1 text-xs text-muted">For two existing sessions taught by other tutors -- you design the prep material, never the session.</p>
        <div className="mt-2">
          <Task12Stage1Form titRecordId={titRecord.id} events={inputEvents} />
        </div>
        <div className="mt-3">
          <Task12Stage1List
            rows={(task12Stage1 ?? []).map((r) => ({
              id: r.id,
              eventTitle: r.timetable_event_id ? eventTitleById.get(r.timetable_event_id) ?? null : null,
              handoutDescription: r.handout_description,
              filedAt: r.filed_at,
            }))}
          />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          Task Twelve, Stage 2 -- sessions you delivered ({(deliveredSessions ?? []).length} of {MIN_DELIVERED_SESSIONS} min)
        </h3>
        <p className="mt-1 text-xs text-muted">Fully self-designed, never reused from the centre&apos;s own Resource Hub library.</p>
        <div className="mt-2">
          <AddDeliveredSessionForm titRecordId={titRecord.id} />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {(deliveredSessions ?? []).length === 0 ? (
            <p className="text-sm text-muted">None delivered yet.</p>
          ) : (
            (deliveredSessions ?? []).map((r) => (
              <DeliveredSessionCard
                key={r.id}
                row={{
                  id: r.id,
                  title: r.title,
                  deliveredAt: r.delivered_at,
                  selfEvaluation: r.self_evaluation,
                  selfEvaluationAt: r.self_evaluation_at,
                  supervisorFeedback: r.supervisor_feedback,
                  supervisorFeedbackAt: r.supervisor_feedback_at,
                }}
              />
            ))
          )}
        </div>
      </section>

      {/* Task Thirteen */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Task Thirteen -- TP feedback you gave</h3>
        <p className="mt-1 text-xs text-muted">A private working copy for each -- your own draft, then discussion, then feedback on how you delivered it. None of this ever reaches a candidate.</p>
        <div className="mt-2">
          <AddFeedbackSessionForm titRecordId={titRecord.id} trainees={(courseTrainees ?? []).map((t) => ({ id: t.id, name: t.full_name }))} />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {(feedbackSessions ?? []).length === 0 ? (
            <p className="text-sm text-muted">No feedback sessions recorded yet.</p>
          ) : (
            (feedbackSessions ?? []).map((r) => (
              <FeedbackSessionCard
                key={r.id}
                row={{
                  id: r.id,
                  traineeName: r.trainee_id ? traineeNameById.get(r.trainee_id) ?? null : null,
                  tpNumber: r.tp_number,
                  conductedAt: r.conducted_at,
                  observedBySupervisor: r.observed_by_supervisor,
                  privateDraft: r.private_draft,
                  supervisorDiscussionNotes: r.supervisor_discussion_notes,
                  finalizedAt: r.finalized_at,
                  feedbackOnFeedbackNotes: r.feedback_on_feedback_notes,
                  feedbackOnFeedbackAt: r.feedback_on_feedback_at,
                }}
              />
            ))
          )}
        </div>
      </section>

      {/* Candidates followed */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">
          Candidates followed start to end ({(candidatesFollowed ?? []).length} of {CANDIDATES_TO_FOLLOW})
        </h3>
        {(candidatesFollowed ?? []).length < CANDIDATES_TO_FOLLOW ? (
          <div className="mt-2">
            <AddCandidateFollowedForm titRecordId={titRecord.id} trainees={(courseTrainees ?? []).map((t) => ({ id: t.id, name: t.full_name }))} />
          </div>
        ) : null}
        <div className="mt-3 flex flex-col gap-2">
          {(candidatesFollowed ?? []).map((r) => (
            <CandidateFollowedCard
              key={r.id}
              row={{
                id: r.id,
                traineeName: traineeNameById.get(r.trainee_id) ?? "Unknown",
                notesBeginning: r.notes_beginning,
                notesMiddle: r.notes_middle,
                notesEnd: r.notes_end,
              }}
            />
          ))}
        </div>
      </section>

      {/* Shadow marking */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Shadow marking -- always double-marked by your supervisor</h3>
        <div className="mt-2">
          <AddShadowMarkingForm titRecordId={titRecord.id} assignments={(courseAssignments ?? []).map((a) => ({ id: a.id, label: assignmentLabelById.get(a.id) ?? "Assignment" }))} />
        </div>
        <div className="mt-3">
          <ShadowMarkingList
            rows={(shadowMarking ?? []).map((r) => ({
              id: r.id,
              assignmentLabel: r.assignment_id ? assignmentLabelById.get(r.assignment_id) ?? null : null,
              titGrade: r.tit_grade,
              supervisorGrade: r.supervisor_grade,
              agreed: r.agreed,
              markedAt: r.marked_at,
            }))}
          />
        </div>
      </section>

      {/* Task Record */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">16-item Task Record (Handbook §7) -- signed by both</h3>
        <div className="mt-2">
          {(taskRecordItems ?? []).map((r) => (
            <TaskRecordItemRow
              key={r.id}
              row={{ id: r.id, itemNumber: r.item_number, label: r.label, titSignedAt: r.tit_signed_at, supervisorSignedAt: r.supervisor_signed_at }}
            />
          ))}
        </div>
      </section>

      {/* Reflective essay */}
      <section>
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Post-course reflective essay</h3>
        <div className="mt-2">
          <ReflectiveEssayForm titRecordId={titRecord.id} essay={titRecord.reflective_essay} submittedAt={titRecord.reflective_essay_submitted_at} />
        </div>
      </section>

      {/* Extra assessor day */}
      {requiresAssessorDay ? (
        <section>
          <h3 className="text-[11px] font-semibold tracking-[0.08em] text-status-warning-text uppercase">
            Extra assessor day -- {titRecord.scheme === "external" ? "external scheme" : "internal scheme, different centre"}
          </h3>
          <div className="mt-2">
            <AssessorDayCard titRecordId={titRecord.id} bookedAt={titRecord.assessor_day_booked_at} completedAt={titRecord.assessor_day_completed_at} />
          </div>
        </section>
      ) : (
        <p className="text-xs text-muted">
          Internal scheme, trains at the nominating centre: no extra assessor day -- your supervisor alone assesses
          your work and e-portfolio, and sends their own moderation report straight to the JCA.
        </p>
      )}

      {/* Outcome */}
      <section className="border-t border-border pt-4">
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">Outcome</h3>
        <div className="mt-2">
          <OutcomeForm titRecordId={titRecord.id} outcome={titRecord.outcome} note={titRecord.outcome_note} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, pct, detail, warning }: { label: string; pct: number; detail: string; warning?: string | null }) {
  const met = pct >= HEADLINE_MIN_PCT;
  return (
    <div className="rounded-[6px] border border-border p-3">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{label}</p>
      <p className={`mt-1 font-serif text-2xl ${met ? "text-primary" : "text-ink"}`}>{pct}%</p>
      <p className="text-xs text-muted">{detail}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className={`h-full rounded-full ${met ? "bg-primary" : "bg-status-warning-text"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {warning ? <p className="mt-1.5 text-xs font-medium text-destructive">{warning}</p> : null}
    </div>
  );
}
