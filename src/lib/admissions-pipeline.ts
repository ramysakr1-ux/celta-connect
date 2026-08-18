import "server-only";
import type { Database } from "@/lib/supabase/types";
import type { ApplicantPaymentState } from "@/lib/payments/applicant-payment-state";

export type ApplicantStage = Database["public"]["Tables"]["applicants"]["Row"]["stage"];

export const FUNNEL_STAGE_KEYS = ["app", "int", "off", "dep", "paid"] as const;
export type FunnelStageKey = (typeof FUNNEL_STAGE_KEYS)[number];

export const FUNNEL_STAGE_META: Record<FunnelStageKey, { label: string; sub: string }> = {
  app: { label: "Applications", sub: "form completed" },
  int: { label: "Interviewed", sub: "task marked, decision made" },
  off: { label: "Offered", sub: "acceptance email sent" },
  dep: { label: "Deposit paid", sub: "place held" },
  paid: { label: "Paid in full", sub: "confirmed" },
};

// Admissions Pipeline.dc.html's 5-stage funnel is coarser than the real
// 11-value applicants.stage enum, so this maps one onto the other. The
// funnel is cumulative ("how far did this person get, at minimum"), not
// "which exact stage are they at now" -- rank 2 means "at least offered,"
// whether or not they later withdrew.
//
// Judgment calls, since a handful of the 11 stages don't map cleanly:
// - rejected_before_interview caps at rank 0 (never reached interview).
// - interview_booked caps at rank 0 too -- the design's own sub-caption is
//   "task marked, decision made," which a booked-not-yet-happened interview
//   hasn't reached.
// - waiting_list / not_this_time / withdrawn_application are terminal
//   states reachable from several points in the real flow, and the stage
//   column alone can't say which. Conservatively ranked at 1 (reached
//   interview) rather than assumed further, since overstating a funnel is
//   worse than understating one.
const STAGE_RANK: Record<ApplicantStage, number> = {
  submitted: 0,
  task_returned: 0,
  interview_booked: 0,
  rejected_before_interview: 0,
  interview_completed: 1,
  rejected_after_interview: 1,
  waiting_list: 1,
  not_this_time: 1,
  withdrawn_application: 1,
  offer_sent: 2,
  accepted: 3,
};

export interface FunnelApplicant {
  id: string;
  fullName: string;
  stage: ApplicantStage;
  createdAt: string;
  offerSentAt: string | null;
  offerAcceptBy: string | null;
  paymentState: ApplicantPaymentState;
  depositPaidAt: string | null;
}

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  sub: string;
  count: number;
  dropPct: number | null;
  applicantIds: string[];
}

export function computeFunnel(applicants: FunnelApplicant[]): FunnelStage[] {
  const rank = (a: FunnelApplicant) => STAGE_RANK[a.stage];
  const buckets: Record<FunnelStageKey, FunnelApplicant[]> = {
    app: applicants,
    int: applicants.filter((a) => rank(a) >= 1),
    off: applicants.filter((a) => rank(a) >= 2),
    dep: applicants.filter((a) => rank(a) >= 3 && a.depositPaidAt),
    paid: applicants.filter((a) => a.paymentState === "paid_in_full"),
  };

  let previousCount: number | null = null;
  return FUNNEL_STAGE_KEYS.map((key) => {
    const bucket = buckets[key];
    const count = bucket.length;
    const dropPct = previousCount && previousCount > 0 ? Math.round(((previousCount - count) / previousCount) * 100) : null;
    previousCount = count;
    return { key, ...FUNNEL_STAGE_META[key], count, dropPct: dropPct && dropPct > 0 ? -dropPct : null, applicantIds: bucket.map((a) => a.id) };
  });
}

export interface FunnelAlert {
  title: string;
  text: string;
  tone: "urgent" | "warning" | "info";
}

// Real alerts, computed from the same data the funnel counts -- not the
// design's illustrative examples. Kept to the three cases the mockup
// itself names: offers about to lapse, a live waiting list, and an
// overdue balance -- the ones with a real deadline attached.
export function computeFunnelAlerts(
  applicants: FunnelApplicant[],
  overdueNames: string[],
  today: string,
  urgentWindowDays = 5
): FunnelAlert[] {
  const alerts: FunnelAlert[] = [];

  const expiring = applicants.filter(
    (a) => a.stage === "offer_sent" && a.offerAcceptBy && a.offerAcceptBy >= today && a.offerAcceptBy <= addDays(today, urgentWindowDays)
  );
  if (expiring.length > 0) {
    alerts.push({
      tone: "urgent",
      title: `${expiring.length} offer${expiring.length === 1 ? "" : "s"} expire${expiring.length === 1 ? "s" : ""} within ${urgentWindowDays} days`,
      text: `${expiring.map((a) => a.fullName).join(", ")}. An unpaid deposit past its deadline releases the place -- but only once somebody says so.`,
    });
  }

  const waitingListCount = applicants.filter((a) => a.stage === "waiting_list").length;
  if (waitingListCount > 0) {
    alerts.push({
      tone: "info",
      title: `The waiting list has ${waitingListCount} ${waitingListCount === 1 ? "person" : "people"} on it`,
      text: "If a held offer lapses, the place can be filled from the list -- but only before day one. A candidate who misses a day of twenty is under the 120-hour minimum.",
    });
  }

  if (overdueNames.length > 0) {
    alerts.push({
      tone: "urgent",
      title: `${overdueNames.length} balance${overdueNames.length === 1 ? " is" : "s are"} overdue`,
      text: `${overdueNames.join(", ")}. Decide now rather than on the first morning.`,
    });
  }

  return alerts;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
