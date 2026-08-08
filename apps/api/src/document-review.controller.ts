import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";

import { DemoStoreService } from "./demo-store.service.js";

const REVIEW_OUTCOMES = ["APPROVED", "CORRECTED", "REJECTED"] as const;

class ReviewFactDto {
  @IsIn(REVIEW_OUTCOMES)
  outcome!: (typeof REVIEW_OUTCOMES)[number];

  @IsOptional()
  @IsString()
  correctedValue?: string;
}

@Controller("documents")
export class DocumentReviewController {
  constructor(private readonly store: DemoStoreService) {}

  @Post(":documentId/facts/:factId/review")
  reviewFact(
    @Headers("x-demo-user") userId: string | undefined,
    @Param("documentId") documentId: string,
    @Param("factId") factId: string,
    @Body() dto: ReviewFactDto,
  ) {
    return this.store.reviewFact(
      userId ?? "",
      documentId,
      factId,
      dto.outcome,
      dto.correctedValue,
    );
  }
}
