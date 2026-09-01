import { AdmissionsTabs } from "@/app/dashboard/admissions/admissions-tabs";

// Admissions had no layout of its own, so its five pages carried no
// navigation and each one was a dead end. One layout gives every page in
// the room the same tab row, the same way Centre Management gets one.
export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <AdmissionsTabs />
      {children}
    </div>
  );
}
