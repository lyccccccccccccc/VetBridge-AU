import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import {
  assertReferralTransition,
  type ReferralStatus,
} from "@vetbridge/domain";

@Injectable()
export class ReferralWorkflowService {
  validateTransition(
    from: ReferralStatus,
    to: ReferralStatus,
  ): { allowed: true; from: ReferralStatus; to: ReferralStatus } {
    try {
      assertReferralTransition(from, to);
      return { allowed: true, from, to };
    } catch {
      throw new UnprocessableEntityException(
        `Referral cannot move from ${from} to ${to}`,
      );
    }
  }
}
