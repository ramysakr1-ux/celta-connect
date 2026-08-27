"use client";

import { removeSubgroupMember } from "@/app/dashboard/admin/courses/[id]/subgroup-actions";

// Same shape as UnpairButton (subgroups-form.tsx) -- removeSubgroupMember
// itself was already built, just never had a matching form component.
export function RemoveMemberButton({ courseId, memberId }: { courseId: string; memberId: string }) {
  return (
    <form action={removeSubgroupMember}>
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="member_id" value={memberId} />
      <button type="submit" className="text-xs text-muted hover:text-destructive">
        Remove
      </button>
    </form>
  );
}
