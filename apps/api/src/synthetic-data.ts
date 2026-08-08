import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ReferralStatus, UserRole } from "@vetbridge/domain";

export type Organisation = {
  id: string;
  name: string;
  type: "REFERRING_CLINIC" | "RECEIVING_HOSPITAL";
};

export type DemoIdentity = {
  id: string;
  displayName: string;
  email: string;
  memberships: Array<{
    organisationId: string;
    role: UserRole;
  }>;
};

export type StatusEvent = {
  id: string;
  fromStatus: ReferralStatus | null;
  toStatus: ReferralStatus;
  changedById: string;
  changedByName: string;
  reason: string | null;
  occurredAt: string;
};

export type AuditEvent = {
  id: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
};

export type ReviewOutcome = "APPROVED" | "CORRECTED" | "REJECTED";

export type ExtractedFact = {
  id: string;
  factType: string;
  candidateValue: string;
  confidence: number;
  sourcePage: number;
  sourceSection: string;
  modelVersion: string;
  review: null | {
    reviewerId: string;
    reviewerName: string;
    outcome: ReviewOutcome;
    correctedValue: string | null;
    reviewedAt: string;
  };
};

export type ClinicalDocument = {
  id: string;
  filename: string;
  mimeType: string;
  storageKey: string;
  status:
    | "UPLOADED"
    | "QUEUED"
    | "PROCESSING"
    | "READY_FOR_REVIEW"
    | "APPROVED"
    | "FAILED";
  uploadedByName: string;
  uploadedAt: string;
  clinicalText: string;
  facts: ExtractedFact[];
  processingJobs?: Array<{
    id: string;
    status: "QUEUED" | "PROCESSING" | "READY_FOR_REVIEW" | "FAILED";
    attempt: number;
    errorMessage: string | null;
    modelVersion: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
};

export type Observation = {
  id: string;
  name: string;
  value: string | number;
  unit?: string;
};

export type DiagnosticResult = {
  id: string;
  name: string;
  value: string | number;
  unit: string | null;
  referenceRange: string | null;
  observedAt: string;
};

export type Condition = {
  id: string;
  code: string;
  display: string;
  clinicalStatus: string;
  recordedAt: string;
};

export type MedicationRecord = {
  id: string;
  name: string;
  instructions: string;
  startsAt: string;
  endsAt: string | null;
  enteredByClinician: boolean;
};

export type Encounter = {
  id: string;
  animalId: string;
  organisationId: string;
  occurredAt: string;
  summary: string;
  observations: Observation[];
  diagnosticResults: DiagnosticResult[];
  conditions: Condition[];
  medicationRecords: MedicationRecord[];
};

export type InformationRequest = {
  id: string;
  referralId: string;
  message: string;
  requestedAt: string;
  resolvedAt: string | null;
};

export type DischargePlan = {
  id: string;
  referralId: string;
  encounterId: string;
  clinicalSummary: string;
  ownerInstructions: string;
  approvedAt: string;
  approvedByName: string;
};

export type FollowUpAlert = {
  id: string;
  status: "REVIEW_REQUIRED" | "ACKNOWLEDGED" | "RESOLVED";
  triggerReasons: string[];
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  clinicalDisclaimer: string;
};

export type FollowUpSubmission = {
  id: string;
  ownerId: string;
  answers: Record<string, string>;
  imageStorageKey: string | null;
  submittedAt: string;
  alerts: FollowUpAlert[];
};

export type FollowUpPlan = {
  id: string;
  referralId: string;
  contactInstructions: string;
  startsAt: string;
  endsAt: string;
  submissions: FollowUpSubmission[];
};

export type DemoReferral = {
  id: string;
  displayId: string;
  animal: {
    id: string;
    name: string;
    species: "DOG" | "CAT";
    breed: string;
    sex: string;
    desexed: boolean;
    dateOfBirth: string;
    weightKg: number;
    microchipNumber: string;
    allergies: string[];
  };
  owner: {
    id: string;
    displayName: string;
    email: string;
    phone: string;
  };
  referringOrganisationId: string;
  receivingOrganisationId: string;
  createdById: string;
  status: ReferralStatus;
  reason: string;
  priority: string;
  submittedAt: string | null;
  lastUpdatedAt: string;
  statusEvents: StatusEvent[];
  documents: ClinicalDocument[];
  auditEvents: AuditEvent[];
  clinicalRecord: {
    scenario: Record<string, unknown>;
    encounters: Encounter[];
    consents: Array<Record<string, unknown>>;
    informationRequests: InformationRequest[];
    dischargePlans: DischargePlan[];
    followUpPlans: FollowUpPlan[];
  };
};

type Catalog = {
  organisations: Organisation[];
  identities: DemoIdentity[];
  caseFiles: string[];
};

type SyntheticCase = {
  scenario: Record<string, unknown>;
  owner: DemoReferral["owner"];
  animal: DemoReferral["animal"] & { ownerId: string };
  encounters: Encounter[];
  referral: Omit<
    DemoReferral,
    "animal" | "owner" | "documents" | "auditEvents" | "clinicalRecord"
  > & {
    animalId: string;
    encounterIds: string[];
  };
  documents: ClinicalDocument[];
  consents: Array<Record<string, unknown>>;
  informationRequests: InformationRequest[];
  dischargePlans: DischargePlan[];
  followUpPlans: FollowUpPlan[];
  auditEvents: AuditEvent[];
};

function findDataDirectory(): string {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.env.VETBRIDGE_DATA_DIR,
    path.resolve(process.cwd(), "data/synthetic/v1"),
    path.resolve(process.cwd(), "../../data/synthetic/v1"),
    path.resolve(moduleDirectory, "../../../data/synthetic/v1"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const directory = candidates.find((candidate) =>
    existsSync(path.join(candidate, "catalog.json")),
  );
  if (!directory) {
    throw new Error(
      `VetBridge synthetic catalog was not found. Checked: ${candidates.join(", ")}`,
    );
  }
  return directory;
}

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(filename, "utf8")) as T;
}

export function loadDemoDataset(): {
  organisations: Organisation[];
  identities: DemoIdentity[];
  referrals: DemoReferral[];
} {
  const directory = findDataDirectory();
  const catalog = readJson<Catalog>(path.join(directory, "catalog.json"));
  const cases = catalog.caseFiles.map((filename) =>
    readJson<SyntheticCase>(path.join(directory, filename)),
  );

  return {
    organisations: structuredClone(catalog.organisations),
    identities: structuredClone(catalog.identities),
    referrals: cases.map((item) => {
      const {
        animalId: _animalId,
        encounterIds: _encounterIds,
        ...referral
      } = item.referral;
      const { ownerId: _ownerId, ...animal } = item.animal;
      return {
        ...referral,
        animal,
        owner: item.owner,
        documents: item.documents,
        auditEvents: item.auditEvents,
        clinicalRecord: {
          scenario: item.scenario,
          encounters: item.encounters,
          consents: item.consents,
          informationRequests: item.informationRequests,
          dischargePlans: item.dischargePlans,
          followUpPlans: item.followUpPlans,
        },
      };
    }),
  };
}
