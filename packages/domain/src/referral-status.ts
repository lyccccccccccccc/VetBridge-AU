export const REFERRAL_STATUSES = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "SUBMITTED",
  "MORE_INFORMATION_REQUIRED",
  "ACCEPTED",
  "APPOINTMENT_BOOKED",
  "ADMITTED",
  "TREATMENT_IN_PROGRESS",
  "DISCHARGED",
  "FOLLOW_UP_ACTIVE",
  "CLOSED",
  "DECLINED",
  "CANCELLED",
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const ALLOWED_REFERRAL_TRANSITIONS: Readonly<
  Record<ReferralStatus, readonly ReferralStatus[]>
> = {
  DRAFT: ["READY_FOR_REVIEW", "CANCELLED"],
  READY_FOR_REVIEW: ["DRAFT", "SUBMITTED", "CANCELLED"],
  SUBMITTED: ["MORE_INFORMATION_REQUIRED", "ACCEPTED", "DECLINED", "CANCELLED"],
  MORE_INFORMATION_REQUIRED: ["SUBMITTED", "CANCELLED"],
  ACCEPTED: ["APPOINTMENT_BOOKED", "ADMITTED", "CANCELLED"],
  APPOINTMENT_BOOKED: ["ADMITTED", "CANCELLED"],
  ADMITTED: ["TREATMENT_IN_PROGRESS"],
  TREATMENT_IN_PROGRESS: ["DISCHARGED"],
  DISCHARGED: ["FOLLOW_UP_ACTIVE", "CLOSED"],
  FOLLOW_UP_ACTIVE: ["CLOSED"],
  CLOSED: [],
  DECLINED: [],
  CANCELLED: [],
};

export class IllegalReferralTransitionError extends Error {
  constructor(from: ReferralStatus, to: ReferralStatus) {
    super(`Illegal referral transition: ${from} -> ${to}`);
    this.name = "IllegalReferralTransitionError";
  }
}

export function canTransitionReferral(
  from: ReferralStatus,
  to: ReferralStatus,
): boolean {
  return ALLOWED_REFERRAL_TRANSITIONS[from].includes(to);
}

export function assertReferralTransition(
  from: ReferralStatus,
  to: ReferralStatus,
): void {
  if (!canTransitionReferral(from, to)) {
    throw new IllegalReferralTransitionError(from, to);
  }
}
