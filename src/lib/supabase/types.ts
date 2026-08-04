// Hand-authored to match the supabase/migrations/*.sql files.
// Once the Supabase CLI is linked, regenerate with:
//   supabase gen types typescript --linked > src/lib/supabase/types.ts

import type { TpProcedure } from "@/lib/tp-density";
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

export type UserRole = "trainee" | "trainer" | "admin";
export type SubmissionStatus =
  | "not_submitted"
  | "pending"
  | "submitted"
  | "resubmission_required"
  | "approved";
export type CriteriaRating = "S+" | "S" | "N" | "X";
export type StandardRating = "above_standard" | "to_standard" | "not_to_standard";
export type PassFail = "pass" | "fail";
export type FinalGrade = "Pass" | "Pass B" | "Pass A" | "Fail" | "Withdrawn";
export type StaffChannelType = "center_trainers" | "all_staff" | "dm";
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
  | "reading_input";
export type ResourceType = "template" | "form" | "brief" | "cambridge_doc" | "reading" | "video";

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
          course_id: string | null;
          terms_accepted_at: string | null;
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
          assignment_type: "Focus on Learner" | "LRT" | "Skills" | "LfC";
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
          final_grade: string | null;
          due_date: string | null;
          tutor_feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["assignments"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          assignment_type: "Focus on Learner" | "LRT" | "Skills" | "LfC";
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
          final_recommended_grade: FinalGrade | null;
          overall_notes: string | null;
          admin_access_granted_at: string | null;
          admin_access_granted_by: string | null;
          admin_access_level: "read" | "edit" | null;
          trainee_signoff_stage2_at: string | null;
          trainer_signoff_final_at: string | null;
          trainee_signoff_final_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["celta5_records"]["Row"]> & {
          course_id: string;
          trainee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["celta5_records"]["Row"]>;
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
          main_lesson_aim: string;
          sub_aim: string | null;
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
        };
        Insert: Partial<Database["public"]["Tables"]["course_subgroups"]["Row"]> & {
          course_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_subgroups"]["Row"]>;
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
          type: "input_session" | "tp" | "assignment_due" | "resubmission_due" | "milestone";
          title: string;
          event_date: string;
          event_time: string | null;
          tag: string | null;
          linked_assignment_type: string | null;
          linked_tp_number: number | null;
          zoom_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["course_timetable_events"]["Row"]> & {
          course_id: string;
          type: "input_session" | "tp" | "assignment_due" | "resubmission_due" | "milestone";
          title: string;
          event_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["course_timetable_events"]["Row"]>;
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
          rotation_position_used: number;
          main_lesson_aim: string;
          sub_aim: string | null;
          materials_description: string | null;
          procedure: TpProcedure | null;
          page_references: string | null;
          density_tier: TpDensityTier;
          assigned_at: string;
          assigned_by: string | null;
          taught_at: string | null;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plan_assignments"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          tp_number: number;
          rotation_position_used: number;
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
          file_url: string;
          category: ResourceCategory;
          resource_type: ResourceType;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["resources"]["Row"]> & {
          center_id: string;
          title: string;
          file_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["resources"]["Row"]>;
        Relationships: [];
      };
      volunteer_students: {
        Row: {
          id: string;
          course_id: string;
          name: string;
          created_at: string;
          removed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["volunteer_students"]["Row"]> & {
          course_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["volunteer_students"]["Row"]>;
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
        Args: Record<string, never>;
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
      submit_assignment_round: {
        Args: { p_assignment_id: string };
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
    };
  };
}
