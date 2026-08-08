import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { REFERRAL_STATUSES, type ReferralStatus } from "@vetbridge/domain";
import { IsIn, IsOptional, IsString } from "class-validator";

import { DemoStoreService } from "./demo-store.service.js";
import { ReferralWorkflowService } from "./referral-workflow.service.js";

class TransitionReferralDto {
  @IsIn(REFERRAL_STATUSES)
  from!: ReferralStatus;

  @IsIn(REFERRAL_STATUSES)
  to!: ReferralStatus;
}

class ApplyTransitionDto {
  @IsIn(REFERRAL_STATUSES)
  to!: ReferralStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller("referrals")
export class ReferralController {
  constructor(
    private readonly workflow: ReferralWorkflowService,
    private readonly store: DemoStoreService,
  ) {}

  @Get()
  list(@Headers("x-demo-user") userId: string | undefined) {
    return this.store.listReferrals(userId ?? "");
  }

  @Get(":referralId")
  detail(
    @Headers("x-demo-user") userId: string | undefined,
    @Param("referralId") referralId: string,
  ) {
    return this.store.getReferral(userId ?? "", referralId);
  }

  @Post("validate-transition")
  validateTransition(@Body() dto: TransitionReferralDto) {
    return this.workflow.validateTransition(dto.from, dto.to);
  }

  @Post(":referralId/transitions")
  transition(
    @Headers("x-demo-user") userId: string | undefined,
    @Param("referralId") referralId: string,
    @Body() dto: ApplyTransitionDto,
  ) {
    return this.store.transition(userId ?? "", referralId, dto.to, dto.reason);
  }
}
