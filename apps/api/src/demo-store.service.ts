import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  ALLOWED_REFERRAL_TRANSITIONS,
  assertReferralTransition,
  REFERRAL_TRANSITION_ROLES,
  type ReferralStatus,
  type UserRole,
} from "@vetbridge/domain";
import {
  loadDemoDataset,
  type DemoIdentity,
  type DemoReferral,
  type ReviewOutcome,
} from "./synthetic-data.js";
import { StatePersistenceService } from "./state-persistence.service.js";

const canonicalDataset = loadDemoDataset();
const organisations = canonicalDataset.organisations;
const identities = canonicalDataset.identities;

function initialReferrals(): DemoReferral[] {
  return structuredClone(canonicalDataset.referrals);
}

@Injectable()
export class DemoStoreService implements OnModuleInit {
  private referrals = initialReferrals();
  private sequence = 100;

  constructor(
    private readonly persistence: StatePersistenceService = new StatePersistenceService(),
  ) {}

  async onModuleInit(): Promise<void> {
    const persisted = await this.persistence.load();
    if (persisted) {
      this.referrals = persisted.referrals;
      this.sequence = persisted.sequence;
    }
  }

  storageMode() {
    return this.persistence.mode;
  }

  listIdentities() {
    return identities.map((identity) => ({
      ...identity,
      memberships: identity.memberships.map((membership) => ({
        ...membership,
        organisation: this.organisation(membership.organisationId),
      })),
    }));
  }

  listReferrals(userId: string) {
    const identity = this.identity(userId);
    return this.referrals
      .filter((referral) => this.canRead(identity, referral))
      .map((referral) => this.toSummary(referral));
  }

  getReferral(userId: string, referralId: string) {
    const identity = this.identity(userId);
    const referral = this.referral(referralId);
    this.assertCanRead(identity, referral);
    return this.toDetail(identity, referral);
  }

  async transition(
    userId: string,
    referralId: string,
    to: ReferralStatus,
    reason?: string,
  ) {
    const identity = this.identity(userId);
    const referral = this.referral(referralId);
    this.assertCanRead(identity, referral);

    try {
      assertReferralTransition(referral.status, to);
    } catch {
      throw new UnprocessableEntityException(
        `Referral cannot move from ${referral.status} to ${to}`,
      );
    }

    const roles = this.rolesForReferral(identity, referral);
    const permittedRoles = REFERRAL_TRANSITION_ROLES[to] ?? [];
    if (!roles.some((role) => permittedRoles.includes(role))) {
      throw new ForbiddenException(
        `${identity.displayName} cannot move this referral to ${to}`,
      );
    }

    const occurredAt = new Date().toISOString();
    const from = referral.status;
    referral.status = to;
    referral.lastUpdatedAt = occurredAt;
    referral.statusEvents.push({
      id: `status-demo-${this.sequence++}`,
      fromStatus: from,
      toStatus: to,
      changedById: identity.id,
      changedByName: identity.displayName,
      reason: reason?.trim() || null,
      occurredAt,
    });
    referral.auditEvents.push({
      id: `audit-demo-${this.sequence++}`,
      actorUserId: identity.id,
      actorName: identity.displayName,
      action: "REFERRAL_STATUS_CHANGED",
      entityType: "Referral",
      entityId: referral.id,
      metadata: { from, to, reason: reason?.trim() || null },
      occurredAt,
    });

    await this.persist();
    return this.toDetail(identity, referral);
  }

  async reviewFact(
    userId: string,
    documentId: string,
    factId: string,
    outcome: ReviewOutcome,
    correctedValue?: string,
  ) {
    const identity = this.identity(userId);
    const referral = this.referrals.find((candidate) =>
      candidate.documents.some((document) => document.id === documentId),
    );
    if (!referral) {
      throw new NotFoundException(`Document ${documentId} was not found`);
    }
    this.assertCanRead(identity, referral);
    const roles = this.rolesForReferral(identity, referral);
    if (!roles.includes("RECEIVING_CLINICIAN")) {
      throw new ForbiddenException(
        "Only a receiving clinician can approve extracted clinical facts",
      );
    }

    const document = referral.documents.find(
      (candidate) => candidate.id === documentId,
    )!;
    const fact = document.facts.find((candidate) => candidate.id === factId);
    if (!fact) {
      throw new NotFoundException(`Fact ${factId} was not found`);
    }
    if (outcome === "CORRECTED" && !correctedValue?.trim()) {
      throw new UnprocessableEntityException(
        "A corrected value is required for CORRECTED reviews",
      );
    }

    const reviewedAt = new Date().toISOString();
    fact.review = {
      reviewerId: identity.id,
      reviewerName: identity.displayName,
      outcome,
      correctedValue: outcome === "CORRECTED" ? correctedValue!.trim() : null,
      reviewedAt,
    };
    if (document.facts.every((candidate) => candidate.review !== null)) {
      document.status = "APPROVED";
    }
    referral.lastUpdatedAt = reviewedAt;
    referral.auditEvents.push({
      id: `audit-demo-${this.sequence++}`,
      actorUserId: identity.id,
      actorName: identity.displayName,
      action: "EXTRACTED_FACT_REVIEWED",
      entityType: "ExtractedClinicalFact",
      entityId: fact.id,
      metadata: {
        documentId,
        outcome,
        correctedValue: outcome === "CORRECTED" ? correctedValue!.trim() : null,
      },
      occurredAt: reviewedAt,
    });

    await this.persist();
    return this.toDetail(identity, referral);
  }

  async resolveInformationRequest(
    userId: string,
    referralId: string,
    requestId: string,
  ) {
    const identity = this.identity(userId);
    const referral = this.referral(referralId);
    this.assertCanRead(identity, referral);
    const roles = this.rolesForReferral(identity, referral);
    if (!roles.includes("REFERRING_VET")) {
      throw new ForbiddenException(
        "Only the referring clinic can mark requested information as supplied",
      );
    }
    const request = referral.clinicalRecord.informationRequests.find(
      (candidate) => candidate.id === requestId,
    );
    if (!request) {
      throw new NotFoundException(
        `Information request ${requestId} was not found`,
      );
    }
    if (request.resolvedAt) {
      throw new UnprocessableEntityException(
        "This information request is already resolved",
      );
    }

    const occurredAt = new Date().toISOString();
    request.resolvedAt = occurredAt;
    referral.lastUpdatedAt = occurredAt;
    referral.auditEvents.push({
      id: `audit-demo-${this.sequence++}`,
      actorUserId: identity.id,
      actorName: identity.displayName,
      action: "REQUESTED_INFORMATION_SUPPLIED",
      entityType: "InformationRequest",
      entityId: request.id,
      metadata: { referralId },
      occurredAt,
    });
    await this.persist();
    return this.toDetail(identity, referral);
  }

  async updateFollowUpAlert(
    userId: string,
    referralId: string,
    alertId: string,
    action: "ACKNOWLEDGE" | "RESOLVE",
  ) {
    const identity = this.identity(userId);
    const referral = this.referral(referralId);
    this.assertCanRead(identity, referral);
    const roles = this.rolesForReferral(identity, referral);
    if (!roles.includes("RECEIVING_CLINICIAN")) {
      throw new ForbiddenException(
        "Only a receiving clinician can action a follow-up alert",
      );
    }
    const alert = referral.clinicalRecord.followUpPlans
      .flatMap((plan) => plan.submissions)
      .flatMap((submission) => submission.alerts)
      .find((candidate) => candidate.id === alertId);
    if (!alert) {
      throw new NotFoundException(`Follow-up alert ${alertId} was not found`);
    }

    const occurredAt = new Date().toISOString();
    if (action === "ACKNOWLEDGE") {
      if (alert.status !== "REVIEW_REQUIRED") {
        throw new UnprocessableEntityException(
          "Only an unreviewed alert can be acknowledged",
        );
      }
      alert.status = "ACKNOWLEDGED";
      alert.acknowledgedAt = occurredAt;
    } else {
      if (alert.status !== "ACKNOWLEDGED") {
        throw new UnprocessableEntityException(
          "A follow-up alert must be acknowledged before it is resolved",
        );
      }
      alert.status = "RESOLVED";
      alert.resolvedAt = occurredAt;
    }
    referral.lastUpdatedAt = occurredAt;
    referral.auditEvents.push({
      id: `audit-demo-${this.sequence++}`,
      actorUserId: identity.id,
      actorName: identity.displayName,
      action:
        action === "ACKNOWLEDGE"
          ? "FOLLOW_UP_ALERT_ACKNOWLEDGED"
          : "FOLLOW_UP_ALERT_RESOLVED",
      entityType: "FollowUpAlert",
      entityId: alert.id,
      metadata: { referralId },
      occurredAt,
    });
    await this.persist();
    return this.toDetail(identity, referral);
  }

  async addDocument(
    userId: string,
    referralId: string,
    file: {
      originalName: string;
      mimeType: string;
      size: number;
      storageKey: string;
    },
  ) {
    const identity = this.identity(userId);
    const referral = this.referral(referralId);
    this.assertCanRead(identity, referral);
    const roles = this.rolesForReferral(identity, referral);
    if (
      !roles.some((role) =>
        ["REFERRING_VET", "RECEIVING_CLINICIAN"].includes(role),
      )
    ) {
      throw new ForbiddenException(
        "Only a clinician from a participating organisation can upload records",
      );
    }

    const occurredAt = new Date().toISOString();
    const documentId = `document-upload-${this.sequence++}`;
    const jobId = `job-upload-${this.sequence++}`;
    referral.documents.push({
      id: documentId,
      filename: file.originalName,
      mimeType: file.mimeType,
      storageKey: file.storageKey,
      status: "QUEUED",
      uploadedByName: identity.displayName,
      uploadedAt: occurredAt,
      clinicalText: "",
      facts: [],
      processingJobs: [
        {
          id: jobId,
          status: "QUEUED",
          attempt: 1,
          errorMessage: null,
          modelVersion: null,
          createdAt: occurredAt,
          completedAt: null,
        },
      ],
    });
    referral.lastUpdatedAt = occurredAt;
    referral.auditEvents.push({
      id: `audit-demo-${this.sequence++}`,
      actorUserId: identity.id,
      actorName: identity.displayName,
      action: "CLINICAL_DOCUMENT_UPLOADED",
      entityType: "ClinicalDocument",
      entityId: documentId,
      metadata: {
        referralId,
        filename: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        jobId,
      },
      occurredAt,
    });
    await this.persist();
    return {
      referral: this.toDetail(identity, referral),
      documentId,
      jobId,
    };
  }

  async processDocument(documentId: string): Promise<void> {
    const referral = this.referrals.find((candidate) =>
      candidate.documents.some((document) => document.id === documentId),
    );
    const document = referral?.documents.find(
      (candidate) => candidate.id === documentId,
    );
    if (!referral || !document) return;
    const job = document.processingJobs?.at(-1);
    if (!job || job.status !== "QUEUED") return;

    job.status = "PROCESSING";
    document.status = "PROCESSING";
    await this.persist();

    const completedAt = new Date().toISOString();
    document.status = "READY_FOR_REVIEW";
    job.status = "READY_FOR_REVIEW";
    job.modelVersion = "document-boundary-v1";
    job.completedAt = completedAt;
    document.clinicalText =
      "Uploaded clinical document queued successfully. Content extraction remains a draft until clinician review.";
    document.facts.push({
      id: `fact-upload-${this.sequence++}`,
      factType: "DOCUMENT_RECEIVED",
      candidateValue: `${document.filename} received for clinician review`,
      confidence: 1,
      sourcePage: 1,
      sourceSection: "Upload metadata",
      modelVersion: "document-boundary-v1",
      review: null,
    });
    referral.lastUpdatedAt = completedAt;
    referral.auditEvents.push({
      id: `audit-demo-${this.sequence++}`,
      actorUserId: null,
      actorName: "Document worker",
      action: "DOCUMENT_PROCESSING_COMPLETED",
      entityType: "ClinicalDocument",
      entityId: document.id,
      metadata: {
        jobId: job.id,
        outcome: "READY_FOR_CLINICIAN_REVIEW",
      },
      occurredAt: completedAt,
    });
    await this.persist();
  }

  async reset() {
    this.referrals = initialReferrals();
    this.sequence = 100;
    await this.persistence.clear();
    await this.persist();
    return { reset: true };
  }

  private async persist(): Promise<void> {
    await this.persistence.save({
      referrals: structuredClone(this.referrals),
      sequence: this.sequence,
    });
  }

  private identity(userId: string) {
    const identity = identities.find((candidate) => candidate.id === userId);
    if (!identity) {
      throw new ForbiddenException(
        "Select a valid local demo identity with the x-demo-user header",
      );
    }
    return identity;
  }

  private referral(referralId: string) {
    const referral = this.referrals.find(
      (candidate) => candidate.id === referralId,
    );
    if (!referral) {
      throw new NotFoundException(`Referral ${referralId} was not found`);
    }
    return referral;
  }

  private organisation(organisationId: string) {
    return organisations.find((candidate) => candidate.id === organisationId)!;
  }

  private rolesForReferral(
    identity: DemoIdentity,
    referral: DemoReferral,
  ): UserRole[] {
    return identity.memberships
      .filter(
        (membership) =>
          membership.organisationId === referral.referringOrganisationId ||
          membership.organisationId === referral.receivingOrganisationId,
      )
      .map((membership) => membership.role);
  }

  private canRead(identity: DemoIdentity, referral: DemoReferral) {
    return identity.memberships.some(
      (membership) =>
        membership.organisationId === referral.referringOrganisationId ||
        membership.organisationId === referral.receivingOrganisationId,
    );
  }

  private assertCanRead(identity: DemoIdentity, referral: DemoReferral) {
    if (!this.canRead(identity, referral)) {
      throw new ForbiddenException(
        "This referral is outside the selected user's organisations",
      );
    }
  }

  private toSummary(referral: DemoReferral) {
    return {
      id: referral.id,
      displayId: referral.displayId,
      animal: referral.animal,
      status: referral.status,
      priority: referral.priority,
      lastUpdatedAt: referral.lastUpdatedAt,
      pendingDocumentFacts: referral.documents.reduce(
        (count, document) =>
          count + document.facts.filter((fact) => fact.review === null).length,
        0,
      ),
    };
  }

  private toDetail(identity: DemoIdentity, referral: DemoReferral) {
    const userRoles = this.rolesForReferral(identity, referral);
    const availableTransitions = ALLOWED_REFERRAL_TRANSITIONS[
      referral.status
    ].filter((to) =>
      userRoles.some((role) =>
        (REFERRAL_TRANSITION_ROLES[to] ?? []).includes(role),
      ),
    );
    return {
      ...referral,
      animal: { ...referral.animal },
      owner: { ...referral.owner },
      statusEvents: referral.statusEvents.map((event) => ({ ...event })),
      documents: referral.documents.map((document) => ({
        ...document,
        facts: document.facts.map((fact) => ({
          ...fact,
          review: fact.review ? { ...fact.review } : null,
        })),
      })),
      auditEvents: referral.auditEvents.map((event) => ({
        ...event,
        metadata: { ...event.metadata },
      })),
      referringOrganisation: this.organisation(
        referral.referringOrganisationId,
      ),
      receivingOrganisation: this.organisation(
        referral.receivingOrganisationId,
      ),
      currentIdentity: {
        id: identity.id,
        displayName: identity.displayName,
        roles: userRoles,
      },
      availableTransitions,
      permissions: {
        canReviewDocuments: userRoles.includes("RECEIVING_CLINICIAN"),
      },
    };
  }
}
