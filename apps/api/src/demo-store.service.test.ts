import {
  ForbiddenException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";

import { DemoStoreService } from "./demo-store.service.js";

describe("DemoStoreService", () => {
  let store: DemoStoreService;

  beforeEach(() => {
    store = new DemoStoreService();
  });

  it("returns only referrals belonging to the selected identity's organisation", async () => {
    expect(store.listReferrals("user-maya-chen")).toHaveLength(3);
    expect(store.listReferrals("user-nora-patel")).toHaveLength(0);
    expect(() => store.getReferral("user-nora-patel", "referral-a")).toThrow(
      ForbiddenException,
    );
  });

  it("loads all three longitudinal cases from the canonical JSON dataset", async () => {
    const caseA = store.getReferral("user-maya-chen", "referral-a");
    const caseB = store.getReferral("user-maya-chen", "referral-b");
    const caseC = store.getReferral("user-maya-chen", "referral-c");

    expect(caseA.clinicalRecord.encounters).toHaveLength(1);
    expect(caseA.documents[0]?.clinicalText).toContain("six vomiting episodes");
    expect(caseB.statusEvents).toHaveLength(4);
    expect(caseB.documents[0]?.facts[0]?.review).toMatchObject({
      outcome: "CORRECTED",
      correctedValue: "Potassium 4.7 mmol/L",
    });
    expect(caseC.clinicalRecord.encounters).toHaveLength(2);
    expect(caseC.clinicalRecord.followUpPlans).toHaveLength(1);
    expect(caseC.auditEvents.at(-1)?.action).toBe("FOLLOW_UP_REVIEW_REQUESTED");
  });

  it("changes status and appends both workflow and audit records", async () => {
    const before = store.getReferral("user-oliver-smith", "referral-a");
    const after = await store.transition(
      "user-oliver-smith",
      "referral-a",
      "ACCEPTED",
      "Clinical history reviewed",
    );

    expect(after.status).toBe("ACCEPTED");
    expect(after.statusEvents).toHaveLength(before.statusEvents.length + 1);
    expect(after.auditEvents).toHaveLength(before.auditEvents.length + 1);
    expect(after.auditEvents.at(-1)).toMatchObject({
      action: "REFERRAL_STATUS_CHANGED",
      metadata: {
        from: "SUBMITTED",
        to: "ACCEPTED",
        reason: "Clinical history reviewed",
      },
    });
  });

  it("rejects legal state changes when the selected role is not permitted", async () => {
    await expect(
      store.transition(
        "user-maya-chen",
        "referral-a",
        "ACCEPTED",
        "Attempted acceptance",
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects skipped workflow states without changing the referral", async () => {
    await expect(
      store.transition(
        "user-oliver-smith",
        "referral-a",
        "DISCHARGED",
        "Invalid jump",
      ),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(store.getReferral("user-oliver-smith", "referral-a").status).toBe(
      "SUBMITTED",
    );
  });

  it("requires receiving-clinician review and records corrections", async () => {
    await expect(
      store.reviewFact(
        "user-maya-chen",
        "document-a-history",
        "fact-a-imaging",
        "APPROVED",
      ),
    ).rejects.toThrow(ForbiddenException);

    const referral = await store.reviewFact(
      "user-oliver-smith",
      "document-a-history",
      "fact-a-imaging",
      "CORRECTED",
      "Possible radiopaque object projected over the small intestine",
    );
    const fact = referral.documents[0]!.facts.find(
      (candidate) => candidate.id === "fact-a-imaging",
    );

    expect(fact?.review).toMatchObject({
      reviewerName: "Dr Oliver Smith",
      outcome: "CORRECTED",
      correctedValue:
        "Possible radiopaque object projected over the small intestine",
    });
    expect(referral.auditEvents.at(-1)?.action).toBe("EXTRACTED_FACT_REVIEWED");
  });

  it("resets all mutable demo state", async () => {
    await store.transition(
      "user-oliver-smith",
      "referral-a",
      "ACCEPTED",
      "Accepted",
    );
    await store.reset();
    expect(store.getReferral("user-oliver-smith", "referral-a").status).toBe(
      "SUBMITTED",
    );
  });

  it("lets the referring clinic supply requested information and audits it", async () => {
    await expect(
      store.resolveInformationRequest(
        "user-oliver-smith",
        "referral-b",
        "info-request-b",
      ),
    ).rejects.toThrow(ForbiddenException);

    const referral = await store.resolveInformationRequest(
      "user-maya-chen",
      "referral-b",
      "info-request-b",
    );
    expect(
      referral.clinicalRecord.informationRequests[0]?.resolvedAt,
    ).toBeTruthy();
    expect(referral.auditEvents.at(-1)?.action).toBe(
      "REQUESTED_INFORMATION_SUPPLIED",
    );
  });

  it("requires receiving-clinician acknowledgement before alert resolution", async () => {
    await expect(
      store.updateFollowUpAlert(
        "user-maya-chen",
        "referral-c",
        "alert-c-1",
        "ACKNOWLEDGE",
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      store.updateFollowUpAlert(
        "user-oliver-smith",
        "referral-c",
        "alert-c-1",
        "RESOLVE",
      ),
    ).rejects.toThrow(UnprocessableEntityException);

    const acknowledged = await store.updateFollowUpAlert(
      "user-oliver-smith",
      "referral-c",
      "alert-c-1",
      "ACKNOWLEDGE",
    );
    expect(
      acknowledged.clinicalRecord.followUpPlans[0]?.submissions[0]?.alerts[0]
        ?.status,
    ).toBe("ACKNOWLEDGED");

    const resolved = await store.updateFollowUpAlert(
      "user-oliver-smith",
      "referral-c",
      "alert-c-1",
      "RESOLVE",
    );
    expect(
      resolved.clinicalRecord.followUpPlans[0]?.submissions[0]?.alerts[0]
        ?.status,
    ).toBe("RESOLVED");
    expect(resolved.auditEvents.at(-1)?.action).toBe(
      "FOLLOW_UP_ALERT_RESOLVED",
    );
  });

  it("queues an uploaded record, processes it, and keeps facts unapproved", async () => {
    const uploaded = await store.addDocument("user-maya-chen", "referral-a", {
      originalName: "new-history.pdf",
      mimeType: "application/pdf",
      size: 128,
      storageKey: "local://new-history.pdf",
    });
    expect(uploaded.referral.documents.at(-1)?.status).toBe("QUEUED");

    await store.processDocument(uploaded.documentId);
    const referral = store.getReferral("user-maya-chen", "referral-a");
    const document = referral.documents.find(
      (candidate) => candidate.id === uploaded.documentId,
    );
    expect(document).toMatchObject({
      status: "READY_FOR_REVIEW",
      processingJobs: [expect.objectContaining({ status: "READY_FOR_REVIEW" })],
    });
    expect(document?.facts[0]?.review).toBeNull();
    expect(referral.auditEvents.at(-1)?.action).toBe(
      "DOCUMENT_PROCESSING_COMPLETED",
    );
  });
});
