import { requireRoomCapability } from "@/lib/auth/require-room";
import { RoomReadOnly } from "@/components/room-readonly";
import { AdmissionsTabs } from "@/app/dashboard/admissions/admissions-tabs";

// Admissions had no layout of its own, so its five pages carried no
// navigation and each one was a dead end. One layout gives every page in
// the room the same tab row, the same way Centre Management gets one.
export default async function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  const { readOnly } = await requireRoomCapability("admissions.view");
  return (
    <div className="flex flex-col gap-6">
      <AdmissionsTabs />
      <RoomReadOnly readOnly={readOnly}>{children}</RoomReadOnly>
    </div>
  );
}
