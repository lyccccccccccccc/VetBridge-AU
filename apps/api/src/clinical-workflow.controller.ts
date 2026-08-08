import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { IsIn } from "class-validator";

import { DemoStoreService } from "./demo-store.service.js";

class FollowUpAlertActionDto {
  @IsIn(["ACKNOWLEDGE", "RESOLVE"])
  action!: "ACKNOWLEDGE" | "RESOLVE";
}

@Controller("referrals")
export class ClinicalWorkflowController {
  constructor(private readonly store: DemoStoreService) {}

  @Post(":referralId/information-requests/:requestId/resolve")
  resolveInformationRequest(
    @Headers("x-demo-user") userId: string | undefined,
    @Param("referralId") referralId: string,
    @Param("requestId") requestId: string,
  ) {
    return this.store.resolveInformationRequest(
      userId ?? "",
      referralId,
      requestId,
    );
  }

  @Post(":referralId/follow-up-alerts/:alertId/actions")
  actionFollowUpAlert(
    @Headers("x-demo-user") userId: string | undefined,
    @Param("referralId") referralId: string,
    @Param("alertId") alertId: string,
    @Body() dto: FollowUpAlertActionDto,
  ) {
    return this.store.updateFollowUpAlert(
      userId ?? "",
      referralId,
      alertId,
      dto.action,
    );
  }
}
