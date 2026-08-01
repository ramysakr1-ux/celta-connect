// Hand-authored to match the supabase/migrations/*.sql files.
// Once the Supabase CLI is linked, regenerate with:
//   supabase gen types typescript --linked > src/lib/supabase/types.ts

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
      celta5_matrix: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          criteria_code: string;
          candidate_status: CriteriaRating | null;
          tutor_status_stage2: CriteriaRating | null;
          tutor_comments_stage2: string | null;
          tutor_status_stage3: CriteriaRating | null;
          tutor_comments_stage3: string | null;
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
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["celta5_records"]["Row"]> & {
          course_id: string;
          trainee_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["celta5_records"]["Row"]>;
        Relationships: [];
      };
      resources: {
        Row: {
          id: string;
          center_id: string;
          course_id: string | null;
          title: string;
          file_url: string;
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
        Returns: Database["public"]["Tables"]["celta5_records"]["Row"];
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
    };
  };
}
