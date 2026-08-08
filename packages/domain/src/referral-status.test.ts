import { describe, expect, it } from "vitest";

import {
  ALLOWED_REFERRAL_TRANSITIONS,
  assertReferralTransition,
  canTransitionReferral,
} from "./referral-status.js";

describe("referral state machine", () => {
  it("permits the complete golden path", () => {
    const path = [
      "DRAFT",
      "READY_FOR_REVIEW",
      "SUBMITTED",
      "ACCEPTED",
      "APPOINTMENT_BOOKED",
      "ADMITTED",
      "TREATMENT_IN_PROGRESS",
      "DISCHARGED",
      "FOLLOW_UP_ACTIVE",
      "CLOSED",
    ] as const;

    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransitionReferral(path[index]!, path[index + 1]!)).toBe(true);
    }
  });

  it("rejects skipped clinical workflow states", () => {
    expect(() => assertReferralTransition("SUBMITTED", "DISCHARGED")).toThrow(
      "Illegal referral transition",
    );
  });

  it("makes terminal states terminal", () => {
    expect(ALLOWED_REFERRAL_TRANSITIONS.CLOSED).toEqual([]);
    expect(ALLOWED_REFERRAL_TRANSITIONS.DECLINED).toEqual([]);
    expect(ALLOWED_REFERRAL_TRANSITIONS.CANCELLED).toEqual([]);
  });
});
