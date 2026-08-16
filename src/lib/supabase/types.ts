// Hand-authored to match the supabase/migrations/*.sql files.
// Once the Supabase CLI is linked, regenerate with:
//   supabase gen types typescript --linked > src/lib/supabase/types.ts

import type { TpProcedure } from "@/lib/tp-density";
import type { AimType } from "@/lib/aim-type";
import type {
  AnalysisBlock,
  FeedbackPoint,
  LanguageAnalysisType,
  PlanProcedureRow,
  ProblemSolutionPair,
  SelfEvalActionPoint,
  VocabRow,
} from "@/lib/tp-plan-content";
import type { AssignmentTypeValue, TemplateSection } from "@/lib/assignment-templates/content";
import type { GradeQueryEvidenceSnapshot } from "@/lib/grade-query-reply";

export type UserRole = "trainee" | "trainer" | "admin" | "admissions";
export type SubmissionStatus =
  | "not_submitted"
  | "pending"
  | "submitted"
  | "resubmission_required"
  | "approved";
export type CriteriaRating = "S+" | "S" | "N" | "X";
export type StandardRating = "above_standard" | "to_standard" | "not_to_standard";
export type PassFail = "pass" | "fail";
export type FinalGrade = "Pass" | "Pass B" | "Pass A" | "Fail" | "Withdrawn" | "Extension" | "Deferred";
export type CourseStatus = "active" | "withdrawn" | "deferred" | "restarting" | "extension";

// specs/build-spec.md §2 "Export is the mirror" -- the three-layer close-out
// protection (course_lifecycle_signup_handoff spec): technical verify ->
// signed receipt -> 7-day grace-hold wipe. States move forward only, except
// verify_failed/export_failed which loop back to a retry of the same step.
export type CourseCloseOutStatus =
  | "not_started"
  | "verifying"
  | "verify_failed"
  | "ready_to_export"
  | "exporting"
  | "export_failed"
  | "awaiting_receipt"
  | "grace_period"
  | "wiped";

export interface CloseOutVerificationIssue {
  traineeId: string;
  traineeName: string;
  artifact: string;
  problem: string;
}
export interface CloseOutVerificationReport {
  checkedAt: string;
  candidateCount: number;
  issues: CloseOutVerificationIssue[];
}

// specs/build-spec.md §3 "first-half restart" -- a frozen snapshot of one
// passed assignment, taken at the moment a candidate is marked eligible to
// restart, not a live reference (see migration 0070).
export interface CarriedAssignmentSnapshot {
  assignment_type: AssignmentTypeValue;
  content_grade: PassFail | null;
  english_grade: PassFail | null;
  marker_id: string | null;
  tutor_feedback: string | null;
  submitted_at: string | null;
  source_assignment_id: string;
}

// specs/build-spec.md §3 "Deferral" -- unlike a restart's single-outcome
// snapshot, a deferral carries the FULL administrative state of every
// assignment (an assignment mid-marking or a resubmission not yet returned
// must be able to continue, not just a final pass/fail).
export interface DeferredAssignmentSnapshot {
  assignment_type: AssignmentTypeValue;
  first_submission_url: string | null;
  first_status: SubmissionStatus;
  first_submitted_at: string | null;
  first_content_grade: PassFail | null;
  first_english_grade: PassFail | null;
  resubmission_url: string | null;
  resubmission_status: SubmissionStatus;
  resubmission_submitted_at: string | null;
  resubmission_content_grade: PassFail | null;
  resubmission_english_grade: PassFail | null;
  resubmission_outcome: "pass" | "fail" | null;
  marker_id: string | null;
  second_marker_id: string | null;
  first_ai_declared: boolean;
  first_ai_conversation_url: string | null;
  resubmission_ai_declared: boolean;
  resubmission_ai_conversation_url: string | null;
  first_own_work_confirmed: boolean;
  resubmission_own_work_confirmed: boolean;
  tutor_feedback: string | null;
  source_assignment_id: string;
}

// A taught TP, credited read-only on the destination course -- "completed
// TPs read-only and credited, with numbering continuing (TP4 next)".
export interface CarriedTpSnapshot {
  tp_number: number;
  tp_point_id: string | null;
  main_lesson_aim: string;
  sub_aim: string | null;
  materials_description: string | null;
  procedure: TpProcedure | null;
  page_references: string | null;
  density_tier: TpDensityTier;
  aim_type: AimType | null;
  taught_at: string | null;
}

export interface CarriedCelta5MatrixEntry {
  criteria_code: string;
  tutor_status_stage2: CriteriaRating | null;
  tutor_status_stage3: CriteriaRating | null;
}

// Content fields only -- deliberately excludes the *_completed_at /
// *_finalized_at reveal-gate timestamps (those control when Stage 1/2/3 is
// exposed to the trainee) and every grade/signoff/checklist field. The
// destination course's tutors reach their own conclusions and their own
// reveal decisions using this as input; carrying an old conclusion or
// silently auto-revealing history to the trainee on day one of a new
// course would both be wrong.
export interface CarriedCelta5Record {
  hours_attended: number | null;
  stage1_tutorial_given: boolean;
  stage1_hours_taught: number | null;
  stage1_strengths: string | null;
  stage1_action_plan: string | null;
  stage2_tutorial_given: boolean;
  stage2_hours_taught: number | null;
  stage2_candidate_overall: StandardRating | null;
  stage2_candidate_notes: string | null;
  stage2_candidate_written_assignments_notes: string | null;
  stage2_candidate_other_notes: string | null;
  stage2_tutor_overall: StandardRating | null;
  stage2_tutor_notes: string | null;
  stage2_tutor_written_assignments_notes: string | null;
  stage2_tutor_other_notes: string | null;
  stage3_required: boolean;
  stage3_tutorial_given: boolean;
  stage3_hours_taught: number | null;
  stage3_tutor_overall: StandardRating | null;
  stage3_tutor_notes: string | null;
  stage3_tutor_written_assignments_notes: string | null;
  stage3_tutor_other_notes: string | null;
}
export type StaffChannelType = "center_trainers" | "all_staff" | "dm" | "tp_group" | "course_admin";
export type TpGenerationStatus = "pending" | "processing" | "completed" | "failed";
export type TpDensityTier = "scripted" | "framework" | "coaching_prose" | "minimal";
export type TpPointStatus = "pending_review" | "published" | "archived";
export type TpGenerationSource = "ai_generated" | "manual";
export type FeedbackTone = "direct" | "supportive";
export type TpMaterialFileType = "pdf" | "image";
export type ResourceCategory =
  | "lesson_planning"
  | "teaching_practice"
  | "written_assignments"
  | "cambridge_documentation"
  | "reading"
  | "input_sessions"
  | "filmed_observations"
  | "admissions"
  | "centre_documents"
  | "forms";
export type ResourceType = "template" | "form" | "brief" | "cambridge_doc" | "reading" | "video";
export type ResourceContentType = "link" | "file" | "html";

// A course's timetable daily structure -- see courses.time_bands. Defined
// here (not in timetable-grid.ts) since timetable-grid.ts already imports
// Database from this file; timetable-grid.ts re-exports/imports this type
// instead of the reverse, to avoid a circular import.
export interface TimeBand {
  start: string;
  end: string;
  label: string;
}

export interface Database {
  public: {
    Tables: {
      centers: {
        Row: {
          id: string;
          name: string;
          center_number: string;
          logo_url: string | null;
          primary_color: string | null;
          accent_color: string | null;
          is_uk_centre: boolean;
          auto_tag_criteria_enabled: boolean;
          is_demo: boolean;
          admissions_stale_threshold_days: number;
          application_low_availability_threshold: number;
          admissions_email: string | null;
          chat_retention_days: number;
          // migration 0106 -- which provider this centre uses, and whether
          // onboarding finished. Never a key or anything in PCI scope: the
          // centre onboards with the provider directly and Connect keeps only
          // a reference. Null is a perfectly normal centre -- card is one of
          // four accepted methods and is never required.
          payment_provider: "stripe" | "iyzico" | "paytr" | "mollie" | "adyen" | null;
          payment_provider_connected_at: string | null;
          payment_provider_connected_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["centers"]["Row"]> & {
          name: string;
          center_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["centers"]["Row"]>;
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          center_id: string;
          name: string;
          start_date: string;
          end_date: string;
          total_hours: number;
          duplicated_from_course_id: string | null;
          trainee_join_token: string;
          trainer_join_token: string;
          timetable_locked_at: string | null;
          time_bands: TimeBand[] | null;
          delivery_mode: "f2f" | "online" | "mixed";
          assessor_visit_date: string | null;
          entry_form_sent_at: string | null;
          cambridge_grades_confirmed_at: string | null;
          cambridge_grades_confirmed_by: string | null;
          application_cap: number | null;
          accepting_applications: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["courses"]["Row"]> & {
          center_id: string;
          name: string;
          start_date: string;
          end_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["courses"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          center_id: string;
          // migration 0103 -- the centre this person is currently acting in.
          // center_id above stays their home centre. Only honoured when a live
          // centre_roles grant backs it, so it's a preference, never authority.
          active_center_id: string | null;
          course_id: string | null;
          tutor_role: string | null;
          terms_accepted_at: string | null;
          special_consideration: string | null;
          uln: string | null;
          connect_hub_link: string | null;
          course_status: CourseStatus;
          course_status_set_at: string | null;
          course_status_set_by: string | null;
          course_status_note: string | null;
          withdrawal_reportable: boolean | null;
          withdrawal_letter_generated_at: string | null;
          extension_completes_by: string | null;
          can_decide_admissions: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          center_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      application_writing_prompts: {
        Row: {
          id: string;
          center_id: string;
          prompt_type: "narrative" | "descriptive" | "argumentative";
          prompt_text: string;
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["application_writing_prompts"]["Row"]> & {
          center_id: string;
          prompt_type: "narrative" | "descriptive" | "argumentative";
          prompt_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["application_writing_prompts"]["Row"]>;
        Relationships: [];
      };
      interview_questions: {
        Row: {
          id: string;
          center_id: string;
          question_text: string;
          coverage_area:
            | "motivation_suitability"
            | "language_awareness"
            | "classroom_presence"
            | "flexibility_openness"
            | "digital_literacy"
            | "time_commitment"
            | "other";
          active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["interview_questions"]["Row"]> & {
          center_id: string;
          question_text: string;
          coverage_area: Database["public"]["Tables"]["interview_questions"]["Row"]["coverage_area"];
        };
        Update: Partial<Database["public"]["Tables"]["interview_questions"]["Row"]>;
        Relationships: [];
      };
      application_links: {
        Row: {
          id: string;
          center_id: string;
          label: string;
          intake_course_id: string | null;
          token: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["application_links"]["Row"]> & {
          center_id: string;
          label: string;
          token: string;
        };
        Update: Partial<Database["public"]["Tables"]["application_links"]["Row"]>;
        Relationships: [];
      };
      applicants: {
        Row: {
          id: string;
          center_id: string;
          intake_course_id: string;
          source_link_id: string | null;
          // migration 0102 -- set only on rows a spreadsheet import created, so
          // an undo can remove exactly those and nothing added by hand since.
          import_id: string | null;
          // migration 0105 -- the deposit that lets a centre invite someone
          // before the balance is settled. On the applicant rather than the
          // payment plan, because it usually arrives before any schedule is
          // agreed, and a payments row can only exist inside a plan.
          deposit_amount: number | null;
          deposit_currency: string | null;
          deposit_paid_at: string | null;
          deposit_marked_by: string | null;
          deposit_note: string | null;
          full_name: string;
          email: string;
          phone: string | null;
          date_of_birth: string | null;
          education_summary: string | null;
          elt_experience_summary: string | null;
          special_requirements: string | null;
          cannot_attend_note: string | null;
          anything_else: string | null;
          acknowledged_no_guarantee_at: string | null;
          acknowledged_no_exemptions_at: string | null;
          acknowledged_mixed_mode_demand_at: string | null;
          writing_task_prompt_id: string | null;
          writing_task_submission: string | null;
          language_awareness_submission: { question: string; answer: string }[];
          ai_reading_summary: unknown | null;
          ai_reading_generated_at: string | null;
          marking_language_awareness: "above" | "at" | "below" | null;
          marking_language_awareness_note: string | null;
          marking_accuracy: "above" | "at" | "below" | null;
          marking_accuracy_note: string | null;
          marking_organisation: "above" | "at" | "below" | null;
          marking_organisation_note: string | null;
          marking_range: "above" | "at" | "below" | null;
          marking_range_note: string | null;
          marking_substance: "above" | "at" | "below" | null;
          marking_substance_note: string | null;
          marked_by: string | null;
          marked_at: string | null;
          stage:
            | "submitted"
            | "task_returned"
            | "interview_booked"
            | "interview_completed"
            | "offer_sent"
            | "accepted"
            | "rejected_before_interview"
            | "rejected_after_interview"
            | "waiting_list"
            | "not_this_time"
            | "withdrawn_application";
          rejection_reason: string | null;
          rejected_at: string | null;
          rejected_by: string | null;
          offer_sent_at: string | null;
          offer_accept_by: string | null;
          offer_token: string | null;
          accepted_at: string | null;
          fee_amount: number | null;
          fee_currency: string | null;
          fee_paid: boolean;
          fee_paid_marked_by: string | null;
          fee_paid_note: string | null;
          fee_paid_at: string | null;
          waiver_note: string | null;
          waiver_agreed_by: string | null;
          waiver_agreed_role: string | null;
          waiting_list_position: number | null;
          waiting_list_hear_by: string | null;
          waiting_list_opt_out: boolean;
          place_offered_at: string | null;
          place_offer_expires_at: string | null;
          resulting_trainee_id: string | null;
          notification_opt_outs: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["applicants"]["Row"]> & {
          center_id: string;
          intake_course_id: string;
          full_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["applicants"]["Row"]>;
        Relationships: [];
      };
      interview_slots: {
        Row: {
          id: string;
          center_id: string;
          intake_course_id: string;
          interviewer_id: string;
          panel: boolean;
          second_interviewer_id: string | null;
          slot_date: string;
          slot_time: string;
          duration_minutes: number;
          mode: "online" | "face_to_face";
          booked_applicant_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["interview_slots"]["Row"]> & {
          center_id: string;
          intake_course_id: string;
          interviewer_id: string;
          slot_date: string;
          slot_time: string;
          mode: "online" | "face_to_face";
        };
        Update: Partial<Database["public"]["Tables"]["interview_slots"]["Row"]>;
        Relationships: [];
      };
      interview_records: {
        Row: {
          id: string;
          applicant_id: string;
          slot_id: string | null;
          fixed_questions: { question_id: string; question_text: string; answer_text: string }[];
          drawn_questions: { question_text: string; answer_text: string; drawn_reason: string | null }[];
          interviewer_signature_name: string | null;
          interviewer_signed_at: string | null;
          applicant_signature_name: string | null;
          applicant_signed_at: string | null;
          overall_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["interview_records"]["Row"]> & {
          applicant_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["interview_records"]["Row"]>;
        Relationships: [];
      };
      admissions_notifications: {
        Row: {
          id: string;
          center_id: string;
          applicant_id: string;
          type: "submitted" | "task_returned" | "interview_completed" | "stale_no_decision" | "place_offered";
          message: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["admissions_notifications"]["Row"]> & {
          center_id: string;
          applicant_id: string;
          type: Database["public"]["Tables"]["admissions_notifications"]["Row"]["type"];
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["admissions_notifications"]["Row"]>;
        Relationships: [];
      };
      payment_plans: {
        Row: {
          id: string;
          center_id: string;
          course_id: string;
          applicant_id: string;
          total_amount: number;
          currency: string;
          instalment_count: number;
          created_at: string;
          created_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["payment_plans"]["Row"]> & {
          center_id: string;
          course_id: string;
          applicant_id: string;
          total_amount: number;
          currency: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_plans"]["Row"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          center_id: string;
          payment_plan_id: string;
          instalment_index: number;
          amount: number;
          currency: string;
          due_date: string | null;
          status: "pending" | "paid" | "missed" | "refunded";
          source: "provider" | "manual" | null;
          provider: string | null;
          provider_checkout_url: string | null;
          provider_transaction_id: string | null;
          marked_by: string | null;
          marked_note: string | null;
          paid_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payments"]["Row"]> & {
          center_id: string;
          payment_plan_id: string;
          instalment_index: number;
          amount: number;
          currency: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Row"]>;
        Relationships: [];
      };
      payment_provider_transactions: {
        Row: {
          id: string;
          center_id: string;
          provider: string;
          provider_event_id: string;
          payment_id: string | null;
          event_type: "payment_succeeded" | "payment_failed" | "refunded";
          amount: number | null;
          currency: string | null;
          raw_payload: unknown;
          received_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payment_provider_transactions"]["Row"]> & {
          center_id: string;
          provider_event_id: string;
          event_type: "payment_succeeded" | "payment_failed" | "refunded";
          raw_payload: unknown;
        };
        Update: Partial<Database["public"]["Tables"]["payment_provider_transactions"]["Row"]>;
        Relationships: [];
      };
      payment_notifications: {
        Row: {
          id: string;
          center_id: string;
          payment_id: string;
          type: "instalment_missed";
          message: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["payment_notifications"]["Row"]> & {
          center_id: string;
          payment_id: string;
          type: "instalment_missed";
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_notifications"]["Row"]>;
        Relationships: [];
      };
      tp_lessons: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          trainer_id: string | null;
          lesson_date: string | null;
          length_minutes: number | null;
          level: string | null;
          learner_count: number | null;
          lesson_focus: string | null;
          tutor_assessment: StandardRating | null;
          tutor_comments: string | null;
          tp_number: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_lessons"]["Row"]> & {
          course_id: string;
          trainee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["tp_lessons"]["Row"]>;
        Relationships: [];
      };
      observations: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          observation_date: string | null;
          length_minutes: number | null;
          level: string | null;
          learners_present: number | null;
          lesson_focus: string | null;
          filmed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["observations"]["Row"]> & {
          course_id: string;
          trainee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["observations"]["Row"]>;
        Relationships: [];
      };
      observation_tasks: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          instructions: string;
          created_by: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["observation_tasks"]["Row"]> & {
          course_id: string;
          title: string;
          instructions: string;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["observation_tasks"]["Row"]>;
        Relationships: [];
      };
      observation_task_submissions: {
        Row: {
          id: string;
          task_id: string;
          trainee_id: string;
          observation_id: string | null;
          response: string;
          submitted_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["observation_task_submissions"]["Row"]> & {
          task_id: string;
          trainee_id: string;
          response: string;
        };
        Update: Partial<Database["public"]["Tables"]["observation_task_submissions"]["Row"]>;
        Relationships: [];
      };
      attendance_absences: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          session_date: string | null;
          category: "unavoidable" | "other";
          reason: string | null;
          work_made_up: string | null;
          tutor_comment: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["attendance_absences"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          category: "unavoidable" | "other";
        };
        Update: Partial<Database["public"]["Tables"]["attendance_absences"]["Row"]>;
        Relationships: [];
      };
      assignments: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          assignment_type: AssignmentTypeValue;
          first_submission_url: string | null;
          first_status: SubmissionStatus;
          first_submitted_at: string | null;
          first_content_grade: PassFail | null;
          first_english_grade: PassFail | null;
          resubmission_url: string | null;
          resubmission_status: SubmissionStatus;
          resubmission_submitted_at: string | null;
          resubmission_content_grade: PassFail | null;
          resubmission_english_grade: PassFail | null;
          resubmission_outcome: "pass" | "fail" | null;
          first_criteria_marks: Record<string, boolean>;
          resubmission_criteria_marks: Record<string, boolean>;
          marker_id: string | null;
          second_marker_id: string | null;
          second_marker_recorded_at: string | null;
          first_submitted_late: boolean;
          first_ai_declared: boolean;
          first_ai_conversation_url: string | null;
          resubmission_ai_declared: boolean;
          resubmission_ai_conversation_url: string | null;
          first_own_work_confirmed: boolean;
          resubmission_own_work_confirmed: boolean;
          final_grade: string | null;
          due_date: string | null;
          tutor_feedback: string | null;
          // Which open malpractice case (if any) is pausing this
          // assignment's marking, and which case (if any) this row IS the
          // Plagiarism Reflection for. See migration 0063.
          open_case_id: string | null;
          reflection_for_case_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["assignments"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          assignment_type: AssignmentTypeValue;
        };
        Update: Partial<Database["public"]["Tables"]["assignments"]["Row"]>;
        Relationships: [];
      };
      assignment_templates: {
        Row: {
          id: string;
          center_id: string;
          assignment_type: AssignmentTypeValue;
          storage_path: string;
          original_filename: string | null;
          sections: TemplateSection[];
          format: "prose" | "structured";
          generation_status: TpGenerationStatus;
          generation_error: string | null;
          published_at: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["assignment_templates"]["Row"]> & {
          center_id: string;
          assignment_type: AssignmentTypeValue;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["assignment_templates"]["Row"]>;
        Relationships: [];
      };
      assignment_type_definitions: {
        Row: {
          id: string;
          center_id: string | null;
          code: string;
          title: string;
          counts_toward_pass: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["assignment_type_definitions"]["Row"]> & {
          code: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["assignment_type_definitions"]["Row"]>;
        Relationships: [];
      };
      restart_transfers: {
        Row: {
          id: string;
          center_id: string;
          source_trainee_id: string;
          source_course_id: string;
          carried_assignments: CarriedAssignmentSnapshot[];
          note: string | null;
          created_by: string;
          created_at: string;
          destination_trainee_id: string | null;
          destination_course_id: string | null;
          linked_at: string | null;
          linked_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["restart_transfers"]["Row"]> & {
          center_id: string;
          source_trainee_id: string;
          source_course_id: string;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["restart_transfers"]["Row"]>;
        Relationships: [];
      };
      deferral_transfers: {
        Row: {
          id: string;
          center_id: string;
          source_trainee_id: string;
          source_course_id: string;
          reasons: string;
          reintegration_arrangements: string | null;
          reintegration_deadline: string | null;
          hours_carried: number;
          hours_carried_overridden: boolean;
          hours_carried_note: string | null;
          carried_assignments: DeferredAssignmentSnapshot[];
          carried_tps: CarriedTpSnapshot[];
          carried_celta5_matrix: CarriedCelta5MatrixEntry[];
          carried_celta5_record: CarriedCelta5Record | null;
          note: string | null;
          created_by: string;
          created_at: string;
          destination_trainee_id: string | null;
          destination_course_id: string | null;
          mode_change_agreed_at: string | null;
          familiarisation_plan: string | null;
          linked_at: string | null;
          linked_by: string | null;
          hold_at_centre: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["deferral_transfers"]["Row"]> & {
          center_id: string;
          source_trainee_id: string;
          source_course_id: string;
          reasons: string;
          hours_carried: number;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["deferral_transfers"]["Row"]>;
        Relationships: [];
      };
      course_close_outs: {
        Row: {
          id: string;
          course_id: string;
          center_id: string;
          status: CourseCloseOutStatus;
          verification_report: CloseOutVerificationReport | null;
          verified_at: string | null;
          verified_by: string | null;
          drive_folder_id: string | null;
          drive_folder_url: string | null;
          exported_at: string | null;
          exported_by: string | null;
          export_error: string | null;
          receipt_requested_at: string | null;
          receipt_signed_name: string | null;
          receipt_signed_at: string | null;
          receipt_signed_by: string | null;
          grace_period_ends_at: string | null;
          wiped_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_close_outs"]["Row"]> & {
          course_id: string;
          center_id: string;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_close_outs"]["Row"]>;
        Relationships: [];
      };
      peer_observation_sheets: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          tp_number: number;
          plan_assignment_id: string | null;
          criteria_codes: string[];
          prompt_1: string;
          prompt_2: string;
          revealed_at: string | null;
          revealed_by: string | null;
          group_feedback: string | null;
          group_feedback_submitted_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["peer_observation_sheets"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          tp_number: number;
          prompt_1: string;
          prompt_2: string;
        };
        Update: Partial<Database["public"]["Tables"]["peer_observation_sheets"]["Row"]>;
        Relationships: [];
      };
      peer_observation_notes: {
        Row: {
          id: string;
          sheet_id: string;
          observer_id: string;
          note_1: string | null;
          note_2: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["peer_observation_notes"]["Row"]> & {
          sheet_id: string;
          observer_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["peer_observation_notes"]["Row"]>;
        Relationships: [];
      };
      tp_capture_notes: {
        Row: {
          id: string;
          course_id: string;
          trainer_id: string;
          trainee_id: string;
          tp_number: number;
          text: string;
          criteria_codes: string[];
          captured_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_capture_notes"]["Row"]> & {
          course_id: string;
          trainer_id: string;
          trainee_id: string;
          tp_number: number;
          text: string;
        };
        Update: Partial<Database["public"]["Tables"]["tp_capture_notes"]["Row"]>;
        Relationships: [];
      };
      malpractice_cases: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          assignment_id: string;
          assignment_round: "first" | "resubmission";
          opened_by: string;
          opened_at: string;
          candidate_account: string | null;
          candidate_account_recorded_at: string | null;
          status: "open" | "decided";
          outcome: "upheld" | "not_upheld" | null;
          decision_notes: string | null;
          decided_by: string | null;
          decided_at: string | null;
          reflection_assignment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["malpractice_cases"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          assignment_id: string;
          assignment_round: "first" | "resubmission";
          opened_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["malpractice_cases"]["Row"]>;
        Relationships: [];
      };
      plagiarism_scanner_findings: {
        Row: {
          id: string;
          assignment_id: string;
          round: "first" | "resubmission";
          section_key: string;
          field_type: "prose" | "analysis";
          matched_text: string;
          match_length: number;
          source_type: "same_course" | "cross_course_archive" | "brief" | "model_answer";
          source_assignment_id: string | null;
          source_course_label: string | null;
          provider: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          case_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plagiarism_scanner_findings"]["Row"]> & {
          assignment_id: string;
          round: "first" | "resubmission";
          section_key: string;
          field_type: "prose" | "analysis";
          matched_text: string;
          match_length: number;
          source_type: "same_course" | "cross_course_archive" | "brief" | "model_answer";
        };
        Update: Partial<Database["public"]["Tables"]["plagiarism_scanner_findings"]["Row"]>;
        Relationships: [];
      };
      submission_text_fingerprints: {
        Row: {
          id: string;
          center_id: string;
          course_id: string;
          course_label: string;
          assignment_type: string;
          section_key: string;
          field_type: "prose" | "analysis";
          shingles: string[];
          source_assignment_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["submission_text_fingerprints"]["Row"]> & {
          center_id: string;
          course_id: string;
          course_label: string;
          assignment_type: string;
          section_key: string;
          field_type: "prose" | "analysis";
          shingles: string[];
        };
        Update: Partial<Database["public"]["Tables"]["submission_text_fingerprints"]["Row"]>;
        Relationships: [];
      };
      assignment_section_responses: {
        Row: {
          id: string;
          assignment_id: string;
          section_key: string;
          section_title: string;
          first_response: string | null;
          first_comments: string | null;
          resubmission_response: string | null;
          resubmission_comments: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["assignment_section_responses"]["Row"]> & {
          assignment_id: string;
          section_key: string;
          section_title: string;
        };
        Update: Partial<Database["public"]["Tables"]["assignment_section_responses"]["Row"]>;
        Relationships: [];
      };
      celta5_matrix: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          criteria_code: string;
          candidate_status: CriteriaRating | null;
          tutor_status_stage2: CriteriaRating | null;
          tutor_status_stage3: CriteriaRating | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["celta5_matrix"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          criteria_code: string;
        };
        Update: Partial<Database["public"]["Tables"]["celta5_matrix"]["Row"]>;
        Relationships: [];
      };
      celta5_records: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          hours_attended: number | null;
          stage1_tutorial_given: boolean;
          stage1_hours_taught: number | null;
          stage1_strengths: string | null;
          stage1_action_plan: string | null;
          stage1_completed_at: string | null;
          stage2_tutorial_given: boolean;
          stage2_hours_taught: number | null;
          stage2_candidate_submitted_at: string | null;
          stage2_candidate_overall: StandardRating | null;
          stage2_candidate_notes: string | null;
          stage2_candidate_written_assignments_notes: string | null;
          stage2_candidate_other_notes: string | null;
          stage2_tutor_overall: StandardRating | null;
          stage2_tutor_notes: string | null;
          stage2_tutor_written_assignments_notes: string | null;
          stage2_tutor_other_notes: string | null;
          stage2_completed_at: string | null;
          stage3_required: boolean;
          stage3_tutorial_given: boolean;
          stage3_hours_taught: number | null;
          stage3_tutor_overall: StandardRating | null;
          stage3_tutor_notes: string | null;
          stage3_tutor_written_assignments_notes: string | null;
          stage3_tutor_other_notes: string | null;
          stage3_finalized_at: string | null;
          provisional_grade: FinalGrade | null;
          provisional_grade_upper: FinalGrade | null;
          provisional_set_at: string | null;
          provisional_upgrade_conditions: string | null;
          final_recommended_grade: FinalGrade | null;
          final_teaching_grade: "Pass" | "Pass B" | "Pass A" | "Fail" | null;
          final_assignments_grade: "Pass" | "Fail" | null;
          overall_notes: string | null;
          admin_access_granted_at: string | null;
          admin_access_granted_by: string | null;
          admin_access_level: "read" | "edit" | null;
          trainee_signoff_stage2_at: string | null;
          trainer_signoff_final_at: string | null;
          trainee_signoff_final_at: string | null;
          final_checklist_tp: boolean;
          final_checklist_observations: boolean;
          final_checklist_assignments: boolean;
          final_checklist_own_work: boolean;
          final_checklist_all_records: boolean;
          grade_review_tutor_comments: string | null;
          final_report_released_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["celta5_records"]["Row"]> & {
          course_id: string;
          trainee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["celta5_records"]["Row"]>;
        Relationships: [];
      };
      grade_query_replies: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          generated_by: string;
          generated_at: string;
          evidence_snapshot: GradeQueryEvidenceSnapshot;
          what_would_have_made_the_difference: string | null;
          what_happens_next: string | null;
          filed_at: string | null;
          filed_by: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["grade_query_replies"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          generated_by: string;
          evidence_snapshot: GradeQueryEvidenceSnapshot;
        };
        Update: Partial<Database["public"]["Tables"]["grade_query_replies"]["Row"]>;
        Relationships: [];
      };
      tp_lesson_criteria_tags: {
        Row: {
          id: string;
          tp_lesson_id: string;
          criteria_code: string;
          tag_type: "strength" | "action_point";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_lesson_criteria_tags"]["Row"]> & {
          tp_lesson_id: string;
          criteria_code: string;
          tag_type: "strength" | "action_point";
        };
        Update: Partial<Database["public"]["Tables"]["tp_lesson_criteria_tags"]["Row"]>;
        Relationships: [];
      };
      tp_coursebooks: {
        Row: {
          id: string;
          center_id: string;
          title: string;
          level: string;
          storage_path: string;
          original_filename: string | null;
          uploaded_by: string | null;
          generation_status: TpGenerationStatus;
          generation_error: string | null;
          access_notes: string | null;
          avoid_repeat_of: string[];
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_coursebooks"]["Row"]> & {
          center_id: string;
          title: string;
          level: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["tp_coursebooks"]["Row"]>;
        Relationships: [];
      };
      tp_coursebook_sources: {
        Row: {
          id: string;
          tp_coursebook_id: string;
          label: string | null;
          storage_path: string;
          original_filename: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_coursebook_sources"]["Row"]> & {
          tp_coursebook_id: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["tp_coursebook_sources"]["Row"]>;
        Relationships: [];
      };
      tp_audio_library: {
        Row: {
          id: string;
          center_id: string;
          level: string;
          coursebook_title: string;
          unit_label: string | null;
          file_name: string;
          storage_path: string;
          original_filename: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_audio_library"]["Row"]> & {
          center_id: string;
          level: string;
          coursebook_title: string;
          file_name: string;
          storage_path: string;
        };
        Update: Partial<Database["public"]["Tables"]["tp_audio_library"]["Row"]>;
        Relationships: [];
      };
      feedback_style_examples: {
        Row: {
          id: string;
          center_id: string;
          tone: FeedbackTone;
          example_text: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["feedback_style_examples"]["Row"]> & {
          center_id: string;
          tone: FeedbackTone;
          example_text: string;
        };
        Update: Partial<Database["public"]["Tables"]["feedback_style_examples"]["Row"]>;
        Relationships: [];
      };
      tp_points: {
        Row: {
          id: string;
          tp_coursebook_id: string;
          center_id: string;
          tp_number: number;
          sequence_index: number;
          density_tier: TpDensityTier;
          aim_type: AimType | null;
          main_lesson_aim: string;
          sub_aim: string | null;
          short_title: string | null;
          materials_description: string | null;
          procedure: TpProcedure | null;
          page_references: string | null;
          generation_source: TpGenerationSource;
          status: TpPointStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_points"]["Row"]> & {
          tp_coursebook_id: string;
          center_id: string;
          tp_number: number;
          sequence_index: number;
          density_tier: TpDensityTier;
          main_lesson_aim: string;
        };
        Update: Partial<Database["public"]["Tables"]["tp_points"]["Row"]>;
        Relationships: [];
      };
      course_subgroups: {
        Row: {
          id: string;
          course_id: string;
          name: string;
          created_at: string;
          tp_group_id: string | null;
          half_order: 1 | 2 | null;
        };
        Insert: Partial<Database["public"]["Tables"]["course_subgroups"]["Row"]> & {
          course_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_subgroups"]["Row"]>;
        Relationships: [];
      };
      course_tp_groups: {
        Row: {
          id: string;
          course_id: string;
          name: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_tp_groups"]["Row"]> & {
          course_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_tp_groups"]["Row"]>;
        Relationships: [];
      };
      stage2_tutorial_blocks: {
        Row: {
          id: string;
          course_id: string;
          timetable_event_id: string;
          tp_group_id: string | null;
          subgroup_id: string | null;
          slot_length_minutes: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["stage2_tutorial_blocks"]["Row"]> & {
          course_id: string;
          timetable_event_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["stage2_tutorial_blocks"]["Row"]>;
        Relationships: [];
      };
      stage2_tutorial_slots: {
        Row: {
          id: string;
          block_id: string;
          position: number;
          trainee_id: string | null;
          booked_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["stage2_tutorial_slots"]["Row"]> & {
          block_id: string;
          position: number;
        };
        Update: Partial<Database["public"]["Tables"]["stage2_tutorial_slots"]["Row"]>;
        Relationships: [];
      };
      course_tutors: {
        Row: {
          id: string;
          course_id: string;
          profile_id: string;
          tutor_role:
            | "main_course_tutor"
            | "assistant_course_tutor"
            | "teaching_practice_tutor"
            | "input_session_tutor"
            | "external_assessor"
            | null;
          is_trainer_in_training: boolean;
          verified_at: string | null;
          supervisor_profile_id: string | null;
          online_experience_evidenced: boolean;
          online_experience_note: string | null;
          joined_at: string;
          left_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_tutors"]["Row"]> & {
          course_id: string;
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_tutors"]["Row"]>;
        Relationships: [];
      };
      course_subgroup_members: {
        Row: {
          id: string;
          subgroup_id: string;
          trainee_id: string;
          base_slot: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_subgroup_members"]["Row"]> & {
          subgroup_id: string;
          trainee_id: string;
          base_slot: number;
        };
        Update: Partial<Database["public"]["Tables"]["course_subgroup_members"]["Row"]>;
        Relationships: [];
      };
      course_broadcasts: {
        Row: {
          id: string;
          course_id: string;
          author_id: string;
          title: string;
          body: string | null;
          pinned: boolean;
          zoom_url: string | null;
          zoom_time: string | null;
          attachment_name: string | null;
          attachment_url: string | null;
          linked_timetable_event_id: string | null;
          created_at: string;
          sent_at: string | null;
          anchor_event_id: string | null;
          anchor_offset_days: number | null;
          keep_on_duplicate: boolean;
          visible_to_tp_group_id: string | null;
          visible_to_subgroup_id: string | null;
          visible_to_trainee_id: string | null;
          source_key: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["course_broadcasts"]["Row"]> & {
          course_id: string;
          author_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_broadcasts"]["Row"]>;
        Relationships: [];
      };
      course_timetable_events: {
        Row: {
          id: string;
          course_id: string;
          type: "input_session" | "tp" | "assignment_due" | "resubmission_due" | "milestone" | "supervised_session";
          title: string;
          event_date: string;
          event_time: string | null;
          tag: string | null;
          linked_assignment_type: string | null;
          linked_tp_number: number | null;
          zoom_url: string | null;
          is_asynchronous: boolean;
          linked_live_session_event_id: string | null;
          input_session_criteria: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_timetable_events"]["Row"]> & {
          course_id: string;
          type: "input_session" | "tp" | "assignment_due" | "resubmission_due" | "milestone" | "supervised_session";
          title: string;
          event_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_timetable_events"]["Row"]>;
        Relationships: [];
      };
      centre_roles: {
        Row: {
          id: string;
          profile_id: string;
          center_id: string;
          role: "centre_administrator" | "centre_manager" | "course_administrator" | "centre_owner";
          granted_by: string | null;
          granted_at: string;
          revoked_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["centre_roles"]["Row"]> & {
          profile_id: string;
          center_id: string;
          role: "centre_administrator" | "centre_manager" | "course_administrator" | "centre_owner";
        };
        Update: Partial<Database["public"]["Tables"]["centre_roles"]["Row"]>;
        Relationships: [];
      };
      course_administrator_scope: {
        Row: {
          id: string;
          centre_role_id: string;
          course_id: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_administrator_scope"]["Row"]> & {
          centre_role_id: string;
          course_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_administrator_scope"]["Row"]>;
        Relationships: [];
      };
      centre_owner_actions: {
        Row: {
          id: string;
          center_id: string;
          actor_profile_id: string;
          action: string;
          target_table: string | null;
          target_id: string | null;
          detail: Record<string, unknown>;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["centre_owner_actions"]["Row"]> & {
          center_id: string;
          actor_profile_id: string;
          action: string;
        };
        Update: Partial<Database["public"]["Tables"]["centre_owner_actions"]["Row"]>;
        Relationships: [];
      };
      spreadsheet_imports: {
        Row: {
          id: string;
          center_id: string;
          intake_course_id: string;
          source_filename: string;
          column_mapping: Record<string, string | null>;
          status_value_mapping: Record<string, string | null>;
          tallies: Record<string, number>;
          created_by: string;
          created_at: string;
          undone_at: string | null;
          undone_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["spreadsheet_imports"]["Row"]> & {
          center_id: string;
          intake_course_id: string;
          source_filename: string;
          created_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["spreadsheet_imports"]["Row"]>;
        Relationships: [];
      };
      supervised_session_completions: {
        Row: {
          id: string;
          timetable_event_id: string;
          trainee_id: string;
          started_at: string;
          time_spent_seconds: number;
          response: string | null;
          submitted_at: string | null;
          checked_at: string | null;
          checked_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["supervised_session_completions"]["Row"]> & {
          timetable_event_id: string;
          trainee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["supervised_session_completions"]["Row"]>;
        Relationships: [];
      };
      course_tp_schedule: {
        Row: {
          id: string;
          course_id: string;
          tp_number: number;
          tp_coursebook_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_tp_schedule"]["Row"]> & {
          course_id: string;
          tp_number: number;
          tp_coursebook_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_tp_schedule"]["Row"]>;
        Relationships: [];
      };
      plan_assignments: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          tp_number: number;
          tp_point_id: string | null;
          // Nullable since migration 0025 -- a manually assigned round
          // (the syllabus planning grid, or the trainer override under
          // rotation/override/) has no rotation position to record.
          rotation_position_used: number | null;
          main_lesson_aim: string;
          sub_aim: string | null;
          short_title: string | null;
          materials_description: string | null;
          procedure: TpProcedure | null;
          page_references: string | null;
          density_tier: TpDensityTier;
          aim_type: AimType | null;
          assigned_at: string;
          assigned_by: string | null;
          taught_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plan_assignments"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          tp_number: number;
          main_lesson_aim: string;
          density_tier: TpDensityTier;
        };
        Update: Partial<Database["public"]["Tables"]["plan_assignments"]["Row"]>;
        Relationships: [];
      };
      tp_plans: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          tp_number: number;
          plan_assignment_id: string | null;
          main_aims: string | null;
          subsidiary_aims: string | null;
          personal_aims: string | null;
          class_profile: string | null;
          materials_description: string | null;
          anticipated_problems: ProblemSolutionPair[];
          framework_used: string | null;
          procedure: PlanProcedureRow[];
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_plans"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          tp_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["tp_plans"]["Row"]>;
        Relationships: [];
      };
      tp_language_analyses: {
        Row: {
          id: string;
          tp_plan_id: string;
          trainee_id: string;
          type: LanguageAnalysisType;
          is_main_aim: boolean;
          context: string | null;
          blocks: AnalysisBlock[];
          vocab_rows: VocabRow[];
          vocab_reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_language_analyses"]["Row"]> & {
          tp_plan_id: string;
          trainee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["tp_language_analyses"]["Row"]>;
        Relationships: [];
      };
      tp_materials: {
        Row: {
          id: string;
          tp_plan_id: string;
          trainee_id: string;
          storage_path: string | null;
          file_name: string | null;
          file_type: TpMaterialFileType | null;
          slides_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_materials"]["Row"]> & {
          tp_plan_id: string;
          trainee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["tp_materials"]["Row"]>;
        Relationships: [];
      };
      tp_self_evaluations: {
        Row: {
          id: string;
          tp_plan_id: string;
          trainee_id: string;
          tp_number: number;
          what_went_well: string | null;
          what_not_as_planned: string | null;
          evidence_of_learning: string | null;
          what_differently: string | null;
          next_tp_focus: string | null;
          action_points: SelfEvalActionPoint[];
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_self_evaluations"]["Row"]> & {
          tp_plan_id: string;
          trainee_id: string;
          tp_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["tp_self_evaluations"]["Row"]>;
        Relationships: [];
      };
      tp_feedback: {
        Row: {
          id: string;
          tp_plan_id: string;
          trainee_id: string;
          tp_number: number;
          trainer_id: string | null;
          grade: StandardRating | null;
          strengths_planning: FeedbackPoint[];
          action_points_planning: FeedbackPoint[];
          strengths_teaching: FeedbackPoint[];
          action_points_teaching: FeedbackPoint[];
          overall_comment: string | null;
          self_eval_comment: string | null;
          submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tp_feedback"]["Row"]> & {
          tp_plan_id: string;
          trainee_id: string;
          tp_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["tp_feedback"]["Row"]>;
        Relationships: [];
      };
      syllabus_planning_entries: {
        Row: {
          id: string;
          course_id: string;
          tp_number: number;
          trainee_id: string;
          main_aim: string;
          sub_aim: string | null;
          material: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["syllabus_planning_entries"]["Row"]> & {
          course_id: string;
          tp_number: number;
          trainee_id: string;
          main_aim: string;
          material: string;
        };
        Update: Partial<Database["public"]["Tables"]["syllabus_planning_entries"]["Row"]>;
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          center_id: string;
          course_id: string | null;
          title: string;
          description: string | null;
          file_url: string | null;
          category: ResourceCategory;
          resource_type: ResourceType;
          visible_to_trainee: boolean;
          storage_path: string | null;
          content_type: ResourceContentType;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["resources"]["Row"]> & {
          center_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["resources"]["Row"]>;
        Relationships: [];
      };
      volunteer_students: {
        Row: {
          id: string;
          course_id: string;
          name: string;
          level: string | null;
          created_at: string;
          removed_at: string | null;
          signup_written_answers: unknown | null;
          signup_audio_url: string | null;
          signup_completed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["volunteer_students"]["Row"]> & {
          course_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["volunteer_students"]["Row"]>;
        Relationships: [];
      };
      volunteer_signup_profiles: {
        Row: {
          id: string;
          center_id: string;
          course_id: string;
          volunteer_student_id: string;
          written_answers: unknown;
          audio_url: string | null;
          transcript: string | null;
          transcript_generated_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["volunteer_signup_profiles"]["Row"]> & {
          center_id: string;
          course_id: string;
          volunteer_student_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["volunteer_signup_profiles"]["Row"]>;
        Relationships: [];
      };
      class_error_log: {
        Row: {
          id: string;
          center_id: string;
          course_id: string;
          logged_by_candidate_id: string;
          learner_id: string;
          tp_class: string;
          tp_number: number;
          lesson_stage: string | null;
          problem_type: "grammar" | "pronunciation";
          note: string;
          logged_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["class_error_log"]["Row"]> & {
          center_id: string;
          course_id: string;
          logged_by_candidate_id: string;
          learner_id: string;
          tp_class: string;
          tp_number: number;
          problem_type: "grammar" | "pronunciation";
          note: string;
        };
        Update: Partial<Database["public"]["Tables"]["class_error_log"]["Row"]>;
        Relationships: [];
      };
      fol_claims: {
        Row: {
          id: string;
          center_id: string;
          course_id: string;
          candidate_id: string;
          problem_type: "grammar" | "pronunciation";
          problem_description: string;
          source: "pooled_log" | "signup_recording";
          claimed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fol_claims"]["Row"]> & {
          center_id: string;
          course_id: string;
          candidate_id: string;
          problem_type: "grammar" | "pronunciation";
          problem_description: string;
          source: "pooled_log" | "signup_recording";
        };
        Update: Partial<Database["public"]["Tables"]["fol_claims"]["Row"]>;
        Relationships: [];
      };
      course_access_tokens: {
        Row: {
          token: string;
          course_id: string;
          role: "volunteer_student" | "assessor" | "register_viewer";
          volunteer_student_id: string | null;
          expires_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_access_tokens"]["Row"]> & {
          course_id: string;
          role: "volunteer_student" | "assessor" | "register_viewer";
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_access_tokens"]["Row"]>;
        Relationships: [];
      };
      volunteer_attendance: {
        Row: {
          id: string;
          volunteer_student_id: string;
          timetable_event_id: string;
          marked_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["volunteer_attendance"]["Row"]> & {
          volunteer_student_id: string;
          timetable_event_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["volunteer_attendance"]["Row"]>;
        Relationships: [];
      };
      pre_course_task_sections: {
        Row: {
          id: string;
          center_id: string;
          source: "cambridge" | "centre_supplement";
          sequence_index: number;
          title: string;
          prompt: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pre_course_task_sections"]["Row"]> & {
          center_id: string;
          source: "cambridge" | "centre_supplement";
          sequence_index: number;
          title: string;
          prompt: string;
        };
        Update: Partial<Database["public"]["Tables"]["pre_course_task_sections"]["Row"]>;
        Relationships: [];
      };
      pre_course_task_responses: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          section_id: string;
          response: string | null;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pre_course_task_responses"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          section_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["pre_course_task_responses"]["Row"]>;
        Relationships: [];
      };
      volunteer_shared_materials: {
        Row: {
          id: string;
          course_id: string;
          tp_material_id: string;
          shared_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["volunteer_shared_materials"]["Row"]> & {
          course_id: string;
          tp_material_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["volunteer_shared_materials"]["Row"]>;
        Relationships: [];
      };
      staff_channels: {
        Row: {
          id: string;
          center_id: string;
          course_id: string | null;
          subgroup_id: string | null;
          type: StaffChannelType;
          name: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["staff_channels"]["Row"]> & {
          center_id: string;
          type: StaffChannelType;
        };
        Update: Partial<Database["public"]["Tables"]["staff_channels"]["Row"]>;
        Relationships: [];
      };
      staff_channel_members: {
        Row: {
          channel_id: string;
          profile_id: string;
          joined_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["staff_channel_members"]["Row"]> & {
          channel_id: string;
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_channel_members"]["Row"]>;
        Relationships: [];
      };
      staff_messages: {
        Row: {
          id: string;
          channel_id: string;
          sender_id: string;
          body: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["staff_messages"]["Row"]> & {
          channel_id: string;
          sender_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["staff_messages"]["Row"]>;
        Relationships: [];
      };
      center_google_connections: {
        Row: {
          center_id: string;
          connected_by: string | null;
          refresh_token: string;
          template_doc_id: string | null;
          output_folder_id: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["center_google_connections"]["Row"]> & {
          center_id: string;
          refresh_token: string;
        };
        Update: Partial<Database["public"]["Tables"]["center_google_connections"]["Row"]>;
        Relationships: [];
      };
      finances: {
        Row: {
          id: string;
          profile_id: string;
          course_id: string;
          total_fee: number;
          amount_paid: number;
          balance_due: number;
          payment_notes: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["finances"]["Row"]> & {
          profile_id: string;
          course_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["finances"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      set_stage2_slot_count: {
        Args: { p_block_id: string; p_slot_count: number };
        Returns: void;
      };
      get_my_celta5_record: {
        Args: Record<string, never>;
        // Narrower than the full table Row: omits admin_access_granted_by,
        // which the trainee has no need to see. Returns a single row (or
        // none) via RETURNS TABLE, so supabase-js resolves it as an array;
        // callers should treat it as the first element or null.
        Returns: Omit<
          Database["public"]["Tables"]["celta5_records"]["Row"],
          "admin_access_granted_by"
        >[];
      };
      get_my_celta5_matrix: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["celta5_matrix"]["Row"][];
      };
      submit_stage2_self_assessment: {
        Args: {
          ratings: Record<string, CriteriaRating>;
          overall: StandardRating;
          notes: string | null;
          written_assignments_notes: string | null;
          other_notes: string | null;
        };
        Returns: void;
      };
      get_or_create_dm_channel: {
        Args: { other_profile_id: string };
        Returns: string;
      };
      trainee_sign_off_stage2: {
        Args: Record<string, never>;
        Returns: void;
      };
      trainee_sign_off_final: {
        Args: {
          p_checklist_tp: boolean;
          p_checklist_observations: boolean;
          p_checklist_assignments: boolean;
          p_checklist_own_work: boolean;
          p_checklist_all_records: boolean;
        };
        Returns: void;
      };
      assign_tp_round: {
        Args: { p_subgroup_id: string; p_tp_number: number };
        Returns: void;
      };
      reorder_subgroup_members: {
        Args: { p_subgroup_id: string; p_ordered_trainee_ids: string[] };
        Returns: void;
      };
      pair_subgroups: {
        Args: { p_course_id: string; p_name: string; p_first_subgroup_id: string; p_second_subgroup_id: string };
        Returns: string;
      };
      submit_assignment_round: {
        Args: {
          p_assignment_id: string;
          p_word_count: number;
          p_ai_declared: boolean;
          p_ai_conversation_url: string | null;
          p_own_work_confirmed: boolean;
        };
        Returns: void;
      };
      save_syllabus_planning_entry: {
        Args: {
          p_tp_number: number;
          p_main_aim: string;
          p_sub_aim: string | null;
          p_material: string;
        };
        Returns: void;
      };
      withdraw_assignment_submission: {
        Args: { p_assignment_id: string };
        Returns: void;
      };
    };
  };
}
