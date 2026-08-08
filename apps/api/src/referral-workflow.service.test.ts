import { UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { ReferralWorkflowService } from "./referral-workflow.service.js";

describe("ReferralWorkflowService", () => {
  const service = new ReferralWorkflowService();

  it("accepts an explicit legal transition", () => {
    expect(service.validateTransition("SUBMITTED", "ACCEPTED")).toEqual({
      allowed: true,
      from: "SUBMITTED",
      to: "ACCEPTED",
    });
  });

  it("rejects a transition that skips human workflow", () => {
    expect(() => service.validateTransition("SUBMITTED", "DISCHARGED")).toThrow(
      UnprocessableEntityException,
    );
  });
});
