import { TrainerHubChrome } from "@/components/trainer-hub-chrome";

// The operational "Command Centre" -- roster/timetable/volunteers/TP
// rotation/TP points library/grades report. Deliberately separate from
// the /trainer landing (candidate cards + a link into here).
//
// The frame itself lives in components/trainer-hub-chrome.tsx, because the
// candidate's pages have to mount the same one (MCT polish pass §10) and a
// layout cannot be shared across route groups.
export default async function TrainerHubLayout({ children }: { children: React.ReactNode }) {
  return <TrainerHubChrome>{children}</TrainerHubChrome>;
}
