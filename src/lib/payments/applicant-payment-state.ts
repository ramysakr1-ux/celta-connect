// The four states Ramy named: "who paid a deposit, who hasn't paid, who paid
// in full, who's paying instalments."
//
// Derived, never stored. A stored status is a second source of truth that
// drifts the moment an instalment is marked paid somewhere else -- the same
// class of problem as the tp_lessons count, which disagreed with reality for
// months because it was written in one place and read in another.

export type ApplicantPaymentState = "not_paid" | "deposit_paid" | "paying_instalments" | "paid_in_full";

export const PAYMENT_STATE_LABEL: Record<ApplicantPaymentState, string> = {
  not_paid: "Not paid",
  deposit_paid: "Deposit paid",
  paying_instalments: "Paying instalments",
  paid_in_full: "Paid in full",
};

export interface PaymentStateInput {
  depositPaidAt: string | null;
  depositAmount: number | null;
  /** Instalments on this applicant's plan, if a plan exists at all. */
  instalments: { amount: number; status: string }[];
  /** The agreed total, when a plan exists. */
  planTotal: number | null;
}

export interface PaymentStateResult {
  state: ApplicantPaymentState;
  label: string;
  /** Still owed on the plan. Null when no plan has been agreed yet. */
  outstanding: number | null;
  /** Deposit counted separately -- it may exist with no plan at all. */
  depositHeld: number;
}

export function computeApplicantPaymentState(input: PaymentStateInput): PaymentStateResult {
  const hasDeposit = Boolean(input.depositPaidAt);
  const depositHeld = hasDeposit ? (input.depositAmount ?? 0) : 0;

  const hasPlan = input.instalments.length > 0 || input.planTotal !== null;
  const paidInstalments = input.instalments.filter((i) => i.status === "paid");
  const owed = input.instalments
    .filter((i) => i.status === "pending" || i.status === "missed")
    .reduce((sum, i) => sum + Number(i.amount), 0);

  let state: ApplicantPaymentState;
  if (hasPlan && input.instalments.length > 0 && owed === 0) {
    // Every instalment resolved and nothing outstanding. Refunded rows count
    // as resolved rather than owed -- money that came back isn't a debt.
    state = "paid_in_full";
  } else if (paidInstalments.length > 0) {
    state = "paying_instalments";
  } else if (hasDeposit) {
    // A deposit with a plan that hasn't started being paid is still just a
    // deposit -- agreeing a schedule isn't paying it.
    state = "deposit_paid";
  } else {
    state = "not_paid";
  }

  return {
    state,
    label: PAYMENT_STATE_LABEL[state],
    outstanding: hasPlan ? owed : null,
    depositHeld,
  };
}
