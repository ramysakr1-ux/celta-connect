import { requireRoomCapability } from "@/lib/auth/require-room";

// Course administration is a room a centre role may or may not hold the
// key to (courseAdmin.view). The header hides the door; this closes it.
export default async function CourseAdminLayout({ children }: { children: React.ReactNode }) {
  await requireRoomCapability("courseAdmin.view");
  return children;
}
