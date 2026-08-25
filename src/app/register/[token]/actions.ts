"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkVolunteerByEmail } from "@/lib/volunteer-identity";
import { LEVEL_OPTIONS } from "@/lib/levels";
import type { Database } from "@/lib/supabase/types";

export interface FormState {
  error: string | null;
}

export interface BulkImportState {
  error: string | null;
  summary: string | null;
}

interface VolunteerRowInput {
  name: string;
  level: string | null;
  email: string | null;
}

// Shared by the single-add form and the CSV bulk import below -- same
// insert + join-link + confirmation-email + mid-course-catch-up sequence
// either way (see the mid-course comment further down), just called once
// per row instead of once per submit.
async function addOneVolunteer(
  admin: SupabaseClient<Database>,
  course: { id: string; center_id: string; start_date: string },
  expiresAt: string,
  input: VolunteerRowInput
): Promise<void> {
  const { data: volunteer, error } = await admin
    .from("volunteer_students")
    .insert({ course_id: course.id, name: input.name, level: input.level, email: input.email })
    .select("id")
    .single();
  if (error || !volunteer) throw new Error("Could not create volunteer_students row");

  await admin.from("course_access_tokens").insert({
    course_id: course.id,
    role: "volunteer_student",
    volunteer_student_id: volunteer.id,
    expires_at: expiresAt,
  });

  // "Signed up -> Confirms it arrived and says honestly that classes run every
  // few months." Skipped without an address -- see migration 0115: a volunteer
  // with no email is a valid volunteer, not a failed one, so this never turns
  // into an error the person at the register screen has to deal with.
  if (!input.email) return;

  await linkVolunteerByEmail(admin, { volunteerStudentId: volunteer.id, centerId: course.center_id, email: input.email });

  const { data: center } = await admin.from("centers").select("name, admissions_email").eq("id", course.center_id).maybeSingle();
  if (center) {
    const { sendApplicantEmail, volunteerSignedUpEmailHtml } = await import("@/lib/admissions-email");
    await sendApplicantEmail({
      centerName: center.name,
      centerAdmissionsEmail: center.admissions_email,
      to: input.email,
      subject: "Thank you for volunteering",
      centerId: course.center_id,
      type: "volunteer_signed_up",
      recipientName: input.name,
      html: volunteerSignedUpEmailHtml({ volunteerName: input.name, centreName: center.name }),
    });
  }

  // Ramy, 25 Aug 2026: "if someone signs up less than a week..." led to
  // finding the real gap -- runVolunteerClassStartingCron only ever looks
  // at courses starting within the next 7 days, so someone registering
  // mid-course (start_date already in the past) would never be picked up
  // by it. The confirmation email above deliberately carries no join link
  // ("nothing further you need to do" -- it's sent long before the link is
  // usable for an early sign-up). For a course already running, that link
  // is usable right now, so send it immediately instead of leaving them
  // with no way to ever get one.
  const today = new Date().toISOString().slice(0, 10);
  if (course.start_date <= today) {
    const { sendVolunteerClassStartingEmail } = await import("@/lib/volunteer-class-starting");
    await sendVolunteerClassStartingEmail(
      admin,
      { id: volunteer.id, name: input.name, email: input.email, level: input.level, course_id: course.id },
      { skipIfAlreadySent: true }
    );
  }
}

// Token-authenticated, not session-authenticated -- whoever holds a
// register_viewer link has no Supabase Auth session at all (center
// business/admissions staff, no app account, not allowed on the course
// itself), so this validates the token itself and reaches the tables
// through the admin client, exactly like /student/[token] does for reads.
export async function addVolunteerStudentViaRegister(_prevState: FormState, formData: FormData): Promise<FormState> {
  const token = formData.get("token");
  const name = (formData.get("name") as string | null)?.trim();
  const level = (formData.get("level") as string | null)?.trim() || null;
  if (typeof token !== "string" || !token) return { error: "Invalid link." };
  if (!name) return { error: "Name is required." };

  const admin = createAdminClient();
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("course_id, expires_at")
    .eq("token", token)
    .eq("role", "register_viewer")
    .maybeSingle();

  if (!accessToken || new Date(accessToken.expires_at) < new Date()) {
    return { error: "This link has expired or isn't valid." };
  }

  const email = (formData.get("email") as string | null)?.trim() || null;

  const { data: course } = await admin
    .from("courses")
    .select("center_id, start_date")
    .eq("id", accessToken.course_id)
    .maybeSingle();
  if (!course) return { error: "Could not add the student. Try again." };

  try {
    await addOneVolunteer(
      admin,
      { id: accessToken.course_id, center_id: course.center_id, start_date: course.start_date },
      accessToken.expires_at,
      { name, level, email }
    );
  } catch {
    return { error: "Could not add the student. Try again." };
  }

  revalidatePath(`/register/${token}`);
  return { error: null };
}

// Minimal CSV parser (quoted fields, embedded commas/quotes/newlines) --
// deliberately dependency-free rather than pulling in a CSV library for
// what's a one-time, small-list import (a Google Sheets "Download as CSV"
// export, not an ongoing data feed).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

// Ramy, 25 Aug 2026: "is that something that could be just connected to
// the drive... all the list of volunteer students would just be pushed" --
// settled on a one-time spreadsheet upload rather than a live Drive sync
// (which would need real Google OAuth credentials only he can create, plus
// ongoing change-detection logic). Centre staff export their sheet as CSV
// and upload it here; every row goes through the exact same addOneVolunteer
// path the single "Add student" form already uses.
export async function addVolunteerStudentsBulk(_prevState: BulkImportState, formData: FormData): Promise<BulkImportState> {
  const token = formData.get("token");
  const csvText = formData.get("csv");
  if (typeof token !== "string" || !token) return { error: "Invalid link.", summary: null };
  if (typeof csvText !== "string" || !csvText.trim()) return { error: "Choose a CSV file first.", summary: null };

  const admin = createAdminClient();
  const { data: accessToken } = await admin
    .from("course_access_tokens")
    .select("course_id, expires_at")
    .eq("token", token)
    .eq("role", "register_viewer")
    .maybeSingle();
  if (!accessToken || new Date(accessToken.expires_at) < new Date()) {
    return { error: "This link has expired or isn't valid.", summary: null };
  }

  const { data: course } = await admin
    .from("courses")
    .select("center_id, start_date")
    .eq("id", accessToken.course_id)
    .maybeSingle();
  if (!course) return { error: "Could not import. Try again.", summary: null };

  const rows = parseCsv(csvText);
  if (rows.length === 0) return { error: "That file looks empty.", summary: null };

  // First row is a header if its first cell reads "name" -- otherwise treat
  // every row as data, in Name/Email/Level column order.
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const looksLikeHeader = header[0] === "name";
  const nameIdx = looksLikeHeader ? header.indexOf("name") : 0;
  const emailIdx = looksLikeHeader ? header.indexOf("email") : 1;
  const levelIdx = looksLikeHeader ? header.indexOf("level") : 2;
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  let added = 0;
  const skipped: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i];
    const rowNum = looksLikeHeader ? i + 2 : i + 1;
    const name = (cells[nameIdx] ?? "").trim();
    if (!name) {
      skipped.push(`row ${rowNum}: no name`);
      continue;
    }
    const email = emailIdx >= 0 ? (cells[emailIdx] ?? "").trim() || null : null;
    const levelRaw = (emailIdx >= 0 && levelIdx >= 0 ? (cells[levelIdx] ?? "") : "").trim().toUpperCase();
    const level = (LEVEL_OPTIONS as readonly string[]).includes(levelRaw) ? levelRaw : null;

    try {
      await addOneVolunteer(
        admin,
        { id: accessToken.course_id, center_id: course.center_id, start_date: course.start_date },
        accessToken.expires_at,
        { name, level, email }
      );
      added++;
    } catch {
      skipped.push(`row ${rowNum} (${name}): could not add`);
    }
  }

  revalidatePath(`/register/${token}`);
  const summary = `${added} volunteer${added === 1 ? "" : "s"} added.${skipped.length ? ` ${skipped.length} skipped -- ${skipped.join("; ")}.` : ""}`;
  return { error: null, summary };
}
