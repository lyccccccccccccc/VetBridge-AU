import { assertReferralTransition } from "@vetbridge/domain";
import { describe, expect, it } from "vitest";

import { syntheticCases } from "./fixtures.js";

describe("synthetic case fixtures", () => {
  it("uses synthetic-only owner email addresses", () => {
    expect(
      syntheticCases.every(({ owner }) => owner.email.endsWith(".invalid")),
    ).toBe(true);
  });

  it("gives every case a valid state history", () => {
    for (const syntheticCase of syntheticCases) {
      for (
        let index = 0;
        index < syntheticCase.statusPath.length - 1;
        index += 1
      ) {
        assertReferralTransition(
          syntheticCase.statusPath[index]!,
          syntheticCase.statusPath[index + 1]!,
        );
      }
    }
  });

  it("covers normal, correction, and follow-up safety scenarios", () => {
    expect(syntheticCases.map(({ id }) => id)).toEqual([
      "referral-a",
      "referral-b",
      "referral-c",
    ]);
    expect(syntheticCases[1].statusPath).toContain("MORE_INFORMATION_REQUIRED");
    expect(syntheticCases[2].statusPath).toContain("FOLLOW_UP_ACTIVE");
  });
});
