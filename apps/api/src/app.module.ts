import { Module } from "@nestjs/common";

import { ClinicalWorkflowController } from "./clinical-workflow.controller.js";
import { DemoController } from "./demo.controller.js";
import { DemoStoreService } from "./demo-store.service.js";
import { DocumentReviewController } from "./document-review.controller.js";
import { DocumentUploadController } from "./document-upload.controller.js";
import { DocumentStorageService } from "./document-storage.service.js";
import { HealthController } from "./health.controller.js";
import { ReferralController } from "./referral.controller.js";
import { ReferralWorkflowService } from "./referral-workflow.service.js";
import { StatePersistenceService } from "./state-persistence.service.js";

@Module({
  controllers: [
    HealthController,
    DemoController,
    ReferralController,
    DocumentReviewController,
    DocumentUploadController,
    ClinicalWorkflowController,
  ],
  providers: [
    ReferralWorkflowService,
    StatePersistenceService,
    DocumentStorageService,
    DemoStoreService,
  ],
})
export class AppModule {}
