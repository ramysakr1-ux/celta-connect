"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateCourseTutor, type FormState } from "@/app/dashboard/admin/settings/actions";
import { DELIVERY_MODE_LABEL, type DeliveryMode } from "@/lib/delivery-mode";

const TUTOR_ROLE_OPTIONS = [
  { value: "main_course_tutor", label: "Main course tutor" },
  { value: "assistant_course_tutor", label: "Assistant course tutor" },
  { value: "teaching_practice_tutor", label: "Teaching practice tutor" },
  { value: "input_session_tutor", label: "Input session tutor" },
  { value: "external_assessor", label: "External assessor" },
];

export interface TutorRowData {
  id: string;
  tutorName: string;
  tutorRole: string | null;
  isTrainerInTraining: boolean;
  verifiedAt: string | null;
  supervisorProfileId: string | null;
  onlineExperienceEvidenced: boolean;
  onlineExperienceNote: string | null;
}

export interface TutorsCourseGroup {
  courseId: string;
  courseName: string;
  deliveryMode: DeliveryMode;
  tutors: TutorRowData[];
}

const initialState: FormState = { error: null };

function TutorRow({
  row,
  requiresOnlineExperience,
  supervisorOptions,
}: {
  row: TutorRowData;
  requiresOnlineExperience: boolean;
  supervisorOptions: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateCourseTutor, initialState);
  const [isTit, setIsTit] = useState(row.isTrainerInTraining);
  const wasPending = useRef(false);

  // Close back to the read view once a submit genuinely completes with no
  // error -- doing this via onClick on the Save button instead races the
  // native form submission (the button's own state update can unmount the
  // form before the browser reads its FormData), which silently drops
  // every field. Watching the pending->settled transition is the only
  // reliable signal that a completed round-trip actually happened.
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setEditing(false);
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  const roleLabel = TUTOR_ROLE_OPTIONS.find((r) => r.value === row.tutorRole)?.label ?? "No role set";
  const supervisorName = supervisorOptions.find((s) => s.id === row.supervisorProfileId)?.name;

  if (!editing) {
    return (
      <tr className="admin-hover border-b border-border-faint last:border-none">
        <td className="py-2.5 text-ink">{row.tutorName}</td>
        <td className="py-2.5 text-muted">{roleLabel}</td>
        <td className="py-2.5 text-muted">
          {row.isTrainerInTraining ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-muted" />
              Training{supervisorName ? ` · supervised by ${supervisorName}` : ""}
            </span>
          ) : (
            "—"
          )}
        </td>
        {requiresOnlineExperience ? (
          <td className="py-2.5 text-muted" title={row.onlineExperienceNote ?? undefined}>
            {row.onlineExperienceEvidenced ? (
              <span className="inline-flex items-center gap-1.5 text-ink">
                <span className="size-1.5 rounded-full bg-current" />
                Evidenced
              </span>
            ) : (
              <span className="text-destructive">Not evidenced</span>
            )}
          </td>
        ) : null}
        <td className="py-2.5 text-right">
          <button type="button" onClick={() => setEditing(true)} className="text-sm text-primary hover:underline">
            Edit
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border-faint last:border-none">
      <td colSpan={requiresOnlineExperience ? 5 : 4} className="py-3">
        <form action={action} className="flex flex-col gap-3 rounded-[6px] border border-border bg-accent/20 p-4">
          <input type="hidden" name="id" value={row.id} />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">{row.tutorName}</p>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-muted hover:text-ink">
              Cancel
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted">Role on this course</label>
            <select
              name="tutor_role"
              defaultValue={row.tutorRole ?? ""}
              className="rounded-[6px] border border-border bg-card-inset px-3 py-1.5 text-sm text-ink"
            >
              <option value="">No role set</option>
              {TUTOR_ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 rounded-[6px] border border-border-faint p-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="is_trainer_in_training"
                defaultChecked={row.isTrainerInTraining}
                onChange={(e) => setIsTit(e.target.checked)}
              />
              Trainer in training
            </label>
            {isTit ? (
              <>
                <p className="text-xs text-muted">
                  Handbook 2.4.4/2.4.5 -- training undertaken without prior Cambridge verification isn&apos;t
                  acknowledged, so a verification date is required before this can be saved as checked.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Verified on</label>
                    <input
                      type="date"
                      name="verified_at"
                      defaultValue={row.verifiedAt ? row.verifiedAt.slice(0, 10) : ""}
                      className="rounded-[6px] border border-border bg-card-inset px-2 py-1.5 text-sm text-ink"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted">Supervised by</label>
                    <select
                      name="supervisor_profile_id"
                      defaultValue={row.supervisorProfileId ?? ""}
                      className="rounded-[6px] border border-border bg-card-inset px-2 py-1.5 text-sm text-ink"
                    >
                      <option value="">Not set</option>
                      {supervisorOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {requiresOnlineExperience ? (
            <div className="flex flex-col gap-2 rounded-[6px] border border-border-faint p-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="online_experience_evidenced" defaultChecked={row.onlineExperienceEvidenced} />
                Online teaching/training experience evidenced
              </label>
              <p className="text-xs text-muted">
                Required for every tutor on an online or mixed-mode course -- this course is one.
              </p>
              <input
                type="text"
                name="online_experience_note"
                defaultValue={row.onlineExperienceNote ?? ""}
                placeholder="e.g. two years teaching on Zoom at a previous centre"
                className="rounded-[6px] border border-border bg-card-inset px-2 py-1.5 text-sm text-ink"
              />
            </div>
          ) : null}

          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-[6px] bg-primary px-3 py-1.5 text-sm font-medium text-card disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </form>
      </td>
    </tr>
  );
}

export function TutorsPanel({
  groups,
  supervisorOptions,
}: {
  groups: TutorsCourseGroup[];
  supervisorOptions: { id: string; name: string }[];
}) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted">No tutors on any course at this centre yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const requiresOnlineExperience = group.deliveryMode !== "f2f";
        return (
          <div key={group.courseId}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-sm font-semibold text-ink">{group.courseName}</h3>
              <span className="text-xs text-muted">{DELIVERY_MODE_LABEL[group.deliveryMode]}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold">Role</th>
                  <th className="pb-2 font-semibold">Trainer in training</th>
                  {requiresOnlineExperience ? <th className="pb-2 font-semibold">Online experience</th> : null}
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {group.tutors.map((row) => (
                  <TutorRow
                    key={row.id}
                    row={row}
                    requiresOnlineExperience={requiresOnlineExperience}
                    supervisorOptions={supervisorOptions}
                  />
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
