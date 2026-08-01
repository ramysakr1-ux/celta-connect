// Hand-authored to match supabase/migrations/0001_init_schema.sql.
// Once the Supabase CLI is linked, regenerate with:
//   supabase gen types typescript --linked > src/lib/supabase/types.ts

export type UserRole = "trainee" | "trainer" | "admin";
export type SubmissionStatus =
  | "not_submitted"
  | "pending"
  | "submitted"
  | "resubmission_required"
  | "approved";
export type CriteriaStatus = "not_yet_assessed" | "developing" | "met" | "not_met";
export type AttendanceStatus = "present" | "absent";

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
      tps: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          trainer_id: string | null;
          tp_number: number;
          lesson_type: string | null;
          main_aim: string | null;
          sub_aim: string | null;
          stage_grades: Record<string, unknown>;
          observation_notes: string | null;
          scheduled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["tps"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          tp_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["tps"]["Row"]>;
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
          resubmission_url: string | null;
          resubmission_status: SubmissionStatus;
          resubmission_submitted_at: string | null;
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
          status: CriteriaStatus;
          tutor_comments: string | null;
          tutorial_transcript_summary: string | null;
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
      attendance: {
        Row: {
          id: string;
          course_id: string;
          trainee_id: string;
          session_id: string;
          join_timestamp: string | null;
          status: AttendanceStatus;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["attendance"]["Row"]> & {
          course_id: string;
          trainee_id: string;
          session_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Row"]>;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
