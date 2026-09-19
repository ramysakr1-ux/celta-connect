import { requireRoomCapability } from "@/lib/auth/require-room";
import { RoomReadOnly } from "@/components/room-readonly";

// Course administration is a room a centre role may or may not hold the
// key to (courseAdmin.view). The header hides the door; this closes it --
// and opens it read-only for a view-level grant.
export default async function CourseAdminLayout({ children }: { children: React.ReactNode }) {
  const { readOnly } = await requireRoomCapability("courseAdmin.view");
  return <RoomReadOnly readOnly={readOnly}>{children}</RoomReadOnly>;
}
