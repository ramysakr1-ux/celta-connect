"use client";

import { useActionState } from "react";
import { updateCenterProfile, type FormState } from "@/app/dashboard/admin/settings/actions";

const initialState: FormState = { error: null };

export function CenterProfileForm({
  name,
  centerNumber,
  isUkCentre,
  admissionsEmail,
}: {
  name: string;
  centerNumber: string;
  isUkCentre: boolean;
  admissionsEmail: string | null;
}) {
  const [state, action, pending] = useActionState(updateCenterProfile, initialState);
  const isPlaceholder = centerNumber.startsWith("PENDING-");

  return (
    <form action={action} className="flex flex-col gap-4">
      {isPlaceholder ? (
        <p className="rounded-[6px] border border-primary bg-primary/10 px-3 py-2 text-sm text-ink">
          This centre number is still a placeholder, auto-generated when the centre was set up.
          Replace it with the real Cambridge-assigned number below.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="center_name" className="text-sm text-muted">
          Centre name
        </label>
        <input
          id="center_name"
          name="name"
          type="text"
          required
          defaultValue={name}
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="center_number" className="text-sm text-muted">
          Centre number
        </label>
        <input
          id="center_number"
          name="center_number"
          type="text"
          required
          defaultValue={isPlaceholder ? "" : centerNumber}
          placeholder="e.g. UK123"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
        <p className="text-xs text-muted">
          Every course this centre runs shares this number -- it&apos;s set once here, not per
          course.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="is_uk_centre" defaultChecked={isUkCentre} />
        This centre is based in the UK
      </label>
      <p className="-mt-2 text-xs text-muted">
        Shows a Unique Learner Number field on the trainee join form -- required for UK education
        and training records, not used elsewhere.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="admissions_email" className="text-sm text-muted">
          Admissions reply-to address
        </label>
        <input
          id="admissions_email"
          name="admissions_email"
          type="email"
          defaultValue={admissionsEmail ?? ""}
          placeholder="admissions@yourcentre.example"
          className="rounded-[6px] border border-border bg-card px-3 py-2 text-ink outline-none focus:border-primary"
        />
        <p className="text-xs text-muted">
          Where replies to applicant emails (offers, rejections) land. Every email is sent from your
          centre&apos;s name, never Connect&apos;s.
        </p>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-[6px] bg-primary px-4 py-2 text-sm font-medium text-card disabled:opacity-60"
      >
        {pending ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
